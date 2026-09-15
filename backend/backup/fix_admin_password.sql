-- Update admin user password to "12345678"
-- After running this, you can login with:
-- Username: 2023304637
-- Password: 12345678

INSERT INTO users (id, student_id, password_hash, created_at, role, department, year_level, section, position, phone, email, otp_code, otp_expires_at, terms_accepted_at, first_name, middle_name, last_name) VALUES
(1, '2023304637', '2023304637', '2025-10-27 10:57:30', 'admin', 'BSIT', '4', 'A', 'ElecomChairPerson', '09308288544', 'rpsvcodes@gmail.com', NULL, NULL, '2025-11-25 11:38:55', 'Redjan Phil', 'Seprado', 'Visitacion');

UPDATE users 
SET password_hash = '$2b$12$glaWeNXkZ4KNM2DF8R9zB.ZNksYBp5K8AAv.UL8DbkPtus2.oZo3y'
WHERE student_id = '2023304637';


