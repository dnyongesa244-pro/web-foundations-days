PRAGMA foreign_keys = ON;

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL UNIQUE
);

CREATE TABLE enrolments (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT NOT NULL,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

INSERT INTO students (student_id, name, email) VALUES
    (1, 'Alice Johnson', 'alice@plp.com'),
    (2, 'Ben Smith', 'ben@plp.com'),
    (3, 'Cara Lee', 'cara@plp.com'),
    (4, 'Dev Patel', 'dev@plp.com');

INSERT INTO courses (course_id, course_name) VALUES
    (101, 'Web Foundations'),
    (102, 'Database Basics'),
    (103, 'JavaScript');

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 101, 'A'),
    (1, 102, 'B'),
    (2, 101, 'B'),
    (2, 103, 'A'),
    (3, 102, 'A');

-- All courses for one student (by name).
SELECT c.course_name
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Alice Johnson'
ORDER BY c.course_name;

-- All students on one course.
SELECT s.name
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_name = 'Web Foundations'
ORDER BY s.name;

-- Number of students per course, including courses with no enrolments.
SELECT c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- Students who have no enrolments.
SELECT s.name
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.student_id IS NULL
ORDER BY s.name;

-- Update one enrolment's grade.
UPDATE enrolments
SET grade = 'A'
WHERE student_id = 1 AND course_id = 102;
