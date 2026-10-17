# Library Books API

Base path: `/books`

## Endpoints

- **List all books**
  - Method: `GET`
  - Path: `/books`
  - Description: Returns a list of all books in the library.
  - Success status: `200 OK`

- **Get one book**
  - Method: `GET`
  - Path: `/books/{bookId}`
  - Description: Returns the book with the specified ID.
  - Success status: `200 OK`

- **Create a book**
  - Method: `POST`
  - Path: `/books`
  - Description: Adds a book to the library.
  - Example request body:
    ```json
    {
      "title": "The Parable of the Pipeline ",
      "author": "Sunny Bindra",
      "publishedYear": 2001
    }
    ```
  - Success status: `201 Created`

- **Update a book**
  - Method: `PUT`
  - Path: `/books/{bookId}`
  - Description: Replaces the details of the book with the specified ID.
  - Example request body:
    ```json
    {
      "title": "The Parable of the Pipeline ",
      "author": "Sunny Bindra",
      "publishedYear": 2001
    }
    ```
  - Success status: `200 OK`

- **Delete a book**
  - Method: `DELETE`
  - Path: `/books/{bookId}`
  - Description: Removes the book with the specified ID from the library.
  - Success status: `204 No Content`

- **List books by author**
  - Method: `GET`
  - Path: `/books?author={authorName}`
  - Description: Returns books whose author matches the `author` query parameter.
  - Success status: `200 OK`

## Error responses

- `400 Bad Request`: The request is invalid, for example a create request is missing the required `title` field.
- `404 Not Found`: The requested book ID does not exist, for example `GET /books/9999`.
