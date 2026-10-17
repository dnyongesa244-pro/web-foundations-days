# SnapShare scaling plan

## Assumptions and estimates

- SnapShare has 10 million registered users, of whom 10% are active on a typical day: **1 million daily active users (DAU)**.
- Each DAU uploads one photo and views 50 feed pages per day, giving **1 million uploads** and **50 million feed-page views per day**.
- Traffic is averaged over 24 hours. Peak feed traffic is estimated at 5 times the average; upload traffic is shown as a daily average because no upload peak multiplier was provided.
- Each original photo is 2 MB and each thumbnail is 50 KB. For the storage estimate, use decimal units (1 TB = 1,000,000 MB), retain all photos for a year, and exclude database data, replicas, backups, and storage overhead.

| Measure | Calculation | Estimate |
| --- | --- | --- |
| Daily active users | 10,000,000 × 10% | **1,000,000 DAU** |
| Uploads per second (average) | 1,000,000 ÷ 86,400 | **about 11.6 uploads/s** |
| Feed views per second (average) | 50 × 1,000,000 ÷ 86,400 | **about 579 views/s** |
| Feed views per second (peak) | 579 × 5 | **about 2,894 views/s** |
| Original photo storage per year | 1,000,000 × 2 MB × 365 | **730 TB/year** |
| Thumbnail storage per year | 1,000,000 × 0.05 MB × 365 | **18.25 TB/year** |
| Total photo-file storage per year | 730 TB + 18.25 TB | **about 748.25 TB/year** |

## Read/write profile

SnapShare is **read-heavy**: users request about 50 feed pages for every photo they upload, so feed reads greatly outnumber photo writes. The design should scale feed delivery with caches, read replicas, and a CDN, while keeping uploads durable and moving thumbnail processing off the request path.

## Photo storage

Photo files should not live inside the relational database: large binary files would inflate database storage and backups and compete with feed and metadata queries for database resources. Store originals and thumbnails in **object storage**, and keep their object keys, ownership, timestamps, and processing status in the database; serve frequently requested image objects through a CDN.

## Architecture

```text
Clients -- API/feed requests --> Load balancer --> App servers
   |                                                  |   |   |
   |                                                  |   |   +--> Photo queue --> Thumbnail worker
   |                                                  |   |                              |
   |                                                  |   |                              +--> Object storage
   |                                                  |   |                                   (read original,
   |                                                  |   |                                    write thumbnail)
   |                                                  |   +--> Primary DB --> Read replica
   |                                                  |         (metadata)     (read queries)
   |                                                  +-------> Cache
   |                                                            (feed/results)
   |
   +-- image GET --> CDN -- cache miss/origin fetch --> Object storage
   |
   +-- signed direct photo upload -------------------> Object storage
                                                        (originals and thumbnails)
```

## Components

- **CDN:** Caches and delivers image files close to users, reducing image latency and origin traffic.
- **Load balancer:** Distributes incoming API requests across healthy app servers so traffic can scale horizontally.
- **App servers:** Authenticate users and handle feed, upload authorization, and photo metadata operations without doing image processing inline.
- **Cache:** Keeps popular feed results and other frequently requested data in fast storage to reduce database load and feed latency.
- **Primary database:** Durably stores user, follow, and photo metadata and handles writes such as new photo records.
- **Read replica:** Serves read queries, especially feed and metadata reads, to reduce load on the primary database.
- **Object storage:** Holds the large original photo and thumbnail files durably and independently of the database.
- **Photo queue:** Buffers thumbnail jobs so bursts of uploads do not overwhelm image-processing capacity or delay upload responses.
- **Thumbnail worker:** Consumes queued jobs, creates the smaller thumbnail from the original, stores it in object storage, and updates its metadata/status.

## Upload flow

1. The client asks an app server to start an upload; the server authenticates the user, validates the request, creates a pending photo metadata record, and returns a short-lived signed upload URL for object storage.
2. The client uploads the original photo directly to object storage using that URL, avoiding a large file transfer through the app server.
3. After the object is stored, the app server (or a storage event handler) places a thumbnail job on the photo queue; the client can be told the original upload succeeded while thumbnail processing continues.
4. A thumbnail worker takes the job, reads the original from object storage, creates a 50 KB thumbnail, and writes the thumbnail back to object storage.
5. The worker marks the photo metadata as ready in the primary database; feed responses can then include the photo and thumbnail object keys, and the CDN can serve the image files.

## Trade-offs

- **Direct-to-object-storage uploads vs. proxying uploads through app servers:** Signed direct uploads reduce app-server bandwidth and scale better for large files, but require careful URL expiry, access controls, and upload validation.
- **Asynchronous thumbnails vs. synchronous processing:** A queue keeps uploads responsive and absorbs bursts, but a photo may temporarily be available without its thumbnail and the system needs retry and failure handling for jobs.
- **Read replicas and caches vs. immediate consistency:** These reduce load and improve feed latency, but cached or replicated data can be briefly stale after a new upload or follow change.
- **CDN caching vs. instant changes/removal:** Caching lowers latency and object-storage egress, but cache invalidation and private-photo access controls add complexity and can delay updates from appearing everywhere.
