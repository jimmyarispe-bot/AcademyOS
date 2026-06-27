-- Prevent duplicate enrollments for the same student in the same class

alter table enrollments
add constraint unique_student_class_enrollment
unique (student_id, class_id);
