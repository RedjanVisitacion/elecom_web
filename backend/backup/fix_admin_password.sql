-- Update admin user password to "12345678"
-- After running this, you can login with:
-- Username: 2023304637
-- Password: 12345678

UPDATE users 
SET password_hash = '$2b$12$glaWeNXkZ4KNM2DF8R9zB.ZNksYBp5K8AAv.UL8DbkPtus2.oZo3y'
WHERE student_id = '2023304637';
