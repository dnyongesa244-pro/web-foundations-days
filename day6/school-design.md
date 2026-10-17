# School database design

## Tables

- **students** stores each student's ID, name, and email. The email is required and unique so the same email cannot identify multiple students.
- **courses** stores each course's ID and name. Both fields are required, and course names are unique.
- **enrolments** records which student takes which course and the student's grade for that course. Its two foreign keys reference `students` and `courses`. The composite primary key `(student_id, course_id)` prevents a student from enrolling in the same course more than once.

## Relationships

One student can have many enrolments, and one course can have many enrolments; each enrolment belongs to one student and one course. Thus, students-to-enrolments and courses-to-enrolments are one-to-many relationships. Taken together, students and courses have a many-to-many relationship: a student can take several courses, and a course can have several students. The `enrolments` join table is needed to represent that relationship and to store grade data for each particular student-course pairing.

## Index

The schema creates an index on `enrolments(course_id)`. The composite primary key starts with `student_id`, so it supports lookups by student but not course-only lookups as efficiently. This additional index helps retrieve a course's enrolments and supports the per-course student-count query.

## SQL or NoSQL?

I would choose a relational SQL database for this system. Students, courses, and enrolments have clear relationships, and foreign keys and unique constraints keep the data consistent—for example, an enrolment cannot refer to a nonexistent student or course, and duplicate student-course pairs are prohibited. SQL joins also make the requested course and student reports straightforward. A NoSQL database could work, but it would require more application-level handling of these relationships and integrity rules without a clear benefit for this small, structured system.
