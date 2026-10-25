# TicketHub ticketing system design

## 1. Requirements

### Functional requirements

- Visitors can browse and search events, view event details, and see current seat availability and prices.
- Registered users can join the queue for a high-demand sale, select available seats, and hold them temporarily while checking out.
- Users can pay for an order, receive tickets only after payment is confirmed, and view their purchased tickets.
- Users can see when a hold expires. Expired or cancelled holds return their seats to availability.
- The system sends a clear result when a seat is no longer available or a payment fails; it must not report an unsuccessful purchase as complete.

### Non-functional requirements

- **Speed:** Event and seat-map reads should respond quickly during ordinary traffic. During a major sale, the waiting room should absorb excess demand and admitted users should receive timely hold and checkout results.
- **Correctness:** A seat can be held by only one active order at a time and sold only once. Orders and ticket records must agree with confirmed payment.
- **Fairness:** Admit sale participants in queue order, provide the same rules and hold duration to everyone, and enforce per-account purchase limits. Clearly tell users their queue position or when inventory is exhausted. Queueing reduces bot and refresh advantages, though it cannot guarantee equal network conditions.
- **Availability and recovery:** A sale should continue if an application instance fails. Payment callbacks and ticket delivery must be safe to retry, and expired holds must eventually release inventory.
- **Security:** Require authentication to hold, pay for, or view tickets; validate all prices and seat IDs server-side; protect payment and ticket data; and use short-lived, unguessable admission tokens.

## 2. Traffic estimates

Assume a day has 86,400 seconds. These are averages; actual traffic will be burstier.

| Measure | Calculation | Estimate |
| --- | --- | --- |
| Normal page views per day | 50,000 visitors × 10 pages | 500,000 |
| Normal page views per second (average) | 500,000 ÷ 86,400 | About 5.8 |
| Normal tickets sold per second (average) | 5,000 ÷ 86,400 | About 0.058 |
| Popular-sale purchase attempts per second (10-minute average) | 200,000 ÷ 600 | About 333 |
| Popular-sale demand per seat | 200,000 people ÷ 20,000 seats | 10 people per seat |
| Popular-sale unmet demand | (200,000 − 20,000) ÷ 200,000 | 90% of attempts cannot get a seat |

The popular sale's average attempt rate is about **58 times the normal daily average page-view rate** (333 ÷ 5.8); it is also a concentrated write-heavy workload rather than ordinary browsing. The 333 attempts per second is an average across ten minutes, not a measured instantaneous peak. For capacity planning, TicketHub should also test for a short **10× burst (about 3,300 attempts per second)** at the sale opening. That burst factor is a planning assumption, not one of the supplied traffic facts. A waiting room meters admitted traffic so the database does not have to process every arrival as a seat-hold transaction at once.

## 3. API

All endpoints use HTTPS. Authenticated endpoints require a user session; mutating requests accept an idempotency key so retries do not create duplicate orders or payments.

| Method and endpoint | Purpose |
| --- | --- |
| `GET /events?query=&date=&page=` | Browse and search published events; paginated results can be cached briefly. |
| `GET /events/{eventId}` | Get event details, venue, sale status, and pricing information. |
| `GET /events/{eventId}/seats` | View the seat map and current availability. Availability is advisory; a seat is not guaranteed until a hold succeeds. |
| `POST /events/{eventId}/queue` | Join a high-demand sale and receive a signed queue token or current queue status. |
| `POST /events/{eventId}/holds` | With a valid admission token, request one or more seats. Atomically creates a pending order and a time-limited hold, or returns a conflict if any requested seat cannot be held. |
| `POST /orders/{orderId}/payment-intent` | Start payment for the authenticated user's pending order. The server uses its recorded order total, not a client-supplied price. |
| `POST /payments/webhook` | Receive and verify the payment provider's signed payment result; process duplicate notifications idempotently. |
| `GET /me/tickets` | List tickets belonging to the authenticated user. |
| `GET /me/tickets/{ticketId}` | Return a specific ticket only to its owner. |

The hold response includes the order ID, held seats, expiry time, and amount due. A failed hold returns a conflict and does not partially reserve a multi-seat request.

## 4. Data model

Use a relational database as the source of truth for inventory and orders.

- **users** (`id` primary key, `email` unique, `created_at`): One user can place many orders.
- **events** (`id` primary key, `name`, `venue`, `starts_at`, `sale_starts_at`, `status`): One event has many event-specific seats and orders.
- **seats** (`id` primary key, `event_id` foreign key, `section`, `row`, `number`, `price`, `status`, `held_by_order_id` nullable foreign key, `hold_expires_at` nullable): Each row represents one sellable seat at one event. A unique constraint on (`event_id`, `section`, `row`, `number`) prevents duplicate seat definitions. `status` is `available`, `held`, or `sold`.
- **orders** (`id` primary key, `user_id` foreign key, `event_id` foreign key, `status`, `total`, `idempotency_key`, `created_at`, `expires_at`): An order belongs to one user and one event. A unique constraint on (`user_id`, `idempotency_key`) makes order-creation retries safe. `status` includes `pending`, `paid`, `expired`, and `cancelled`.
- **order_items** (`id` primary key, `order_id` foreign key, `seat_id` foreign key, `price_paid`): A confirmed order has one item per ticket. A unique constraint on `seat_id` ensures a seat cannot appear in two completed orders.

Relationships: `users 1—many orders`; `events 1—many seats` and `events 1—many orders`; `orders 1—many order_items`; and `seats 1—0-or-1 order_item`. A pending hold is represented by the seat's `held_by_order_id` and expiry; an order item is created only when that order is confirmed as paid. This keeps expired holds from permanently occupying the unique sold-ticket record.

## 5. Preventing two people from buying the same seat

The database, not a cached seat map or application-server check, makes the final decision. In a transaction, the hold operation conditionally updates each requested seat only if it is available or its previous hold has expired. It sets `status = 'held'`, `held_by_order_id`, and `hold_expires_at`. The transaction succeeds only if every requested seat was updated; otherwise it rolls back the whole request. Row-level locking and the conditional update mean simultaneous requests for the same seat cannot both win: one update succeeds, and the other finds that the seat is no longer eligible.

On verified payment, another transaction checks that the order is still pending and unexpired and that every seat is still held by that order. It changes those seats to `sold`, inserts the order items, and marks the order paid. The unique `order_items.seat_id` constraint is a final backstop against selling the same seat twice. If payment fails or the hold expires, a guarded update releases seats only when `held_by_order_id` still matches that order, so an old expiry job cannot release a newer customer's hold. Payment webhooks are idempotent; a late successful payment after inventory has been released must be voided or refunded rather than confirmed with tickets.

## 6. Architecture

```text
                         +----------------------+
Clients -- browse ------>| CDN / read cache     |----> App/API servers
   |                     +----------------------+             |
   | queue / hold / pay                                        +----> Event cache
   v                                                           |
Load balancer --> Admission service --> Waiting-room queue     +----> Primary relational DB
                                         (signed tokens,       |      (seats, orders,
                                          rate control)        |       transactions)
                                                              |
                                                              +----> Payment service <----> Payment provider
                                                              |             ^
                                                              |             |
                                                              +------ verified webhook
                                                              |
                                                              +----> Message queue --> Ticket/notification worker
                                                                                       |
                                                                                       +--> Email / ticket delivery
```

- **CDN and read cache:** Serve static assets and cache public event details and seat-map snapshots. Seat-map availability is explicitly indicative, never authoritative for a purchase.
- **Load balancer and app/API servers:** Distribute requests across stateless instances that can scale horizontally. They authenticate users, validate requests, and call backend services.
- **Admission service and waiting-room queue:** Assign queue positions and issue signed, short-lived admission tokens in arrival order. It meters access to hold operations and rejects invalid or reused tokens, smoothing the opening surge.
- **Primary relational database:** Stores authoritative seat state, holds, orders, and completed tickets. Transactions, row-level locking, and uniqueness constraints enforce inventory correctness. Avoid serving purchase decisions from replicas or cache.
- **Payment service and provider:** Create payments using the order's server-calculated total and receive signed webhooks. The payment provider is outside the database transaction, so idempotent callbacks and late-payment handling are required.
- **Message queue and ticket/notification worker:** Decouple ticket generation and email from checkout. Workers can retry delivery without charging again or changing seat ownership.

## 7. Trade-offs

- **Strict database transactions vs. maximum write throughput:** Serializing access to a seat protects correctness but limits writes for heavily contested seats. The waiting room reduces contention; inventory must not be moved to an eventually consistent cache just to increase throughput.
- **FIFO waiting room vs. direct access:** FIFO admission is more predictable and reduces refresh races, but introduces queue infrastructure and does not guarantee equal connectivity or eliminate all automated abuse.
- **Temporary holds vs. immediate purchase:** Holds give users time to pay and prevent another buyer from taking their seats during checkout, but reduce available inventory while a user decides. A short, clearly displayed expiry and reliable release process balance these effects.
- **Cached seat maps vs. live reads:** Caching improves browsing speed and lowers database load, but availability can be stale. The hold endpoint must recheck and atomically reserve seats in the primary database.
