-- PostgreSQL version of student table and data

-- Create student table
CREATE TABLE student (
  id_number int NOT NULL,
  first_name varchar(255) NOT NULL,
  middle_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  course varchar(255) NOT NULL,
  year int NOT NULL,
  section varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  phone_number varchar(255) NOT NULL,
  role varchar(255) NOT NULL
);

-- Insert student data
INSERT INTO student (id_number, first_name, middle_name, last_name, course, year, section, email, phone_number, role) VALUES
(2022309359, 'Alexander', 'Regale', 'Pepito', 'BSIT', 3, 'A', 'alexanderpepitojr6@gmail.com', '09122135471', 'student'),
(2022310650, 'Kurt Collin Clint', 'Binaoro', 'Mabalod', 'BSIT', 3, 'A', 'kurtcollinclintm@gmail.com', '09632986745', 'student'),
(2023304604, 'Mae', 'Sumagang', 'Rodriguez', 'BSIT', 3, 'A', 'maerodriguez491@gmail.com', '09811284867', 'student'),
(2023304615, 'Lester', '', 'Bulay', 'BSIT', 3, 'A', 'lesterbulay18@gmail.com', '09817149863', 'student'),
(2023304637, 'Redjan Phil', 'Seprado', 'Visitacion', 'BSIT', 3, 'A', 'rpsvcodes@gmail.com', '09534181760', 'student'),
(2023304652, 'Vince Rey', 'Lapura', 'Claveria', 'BSIT', 3, 'A', 'vincereyclaveria@gmail.com', '09380324622', 'student'),
(2023304665, 'Rissa Flor', 'Icao', 'Arnaiz', 'BSIT', 3, 'A', 'rissaflorarnaiz70@gmail.com', '09097766612', 'student'),
(2023304673, 'Alyssa Mae', 'Carreon', 'Rodriguez', 'BSIT', 3, 'A', 'rodriguezalyssa3@gmail.com', '0912962643', 'student'),
(2023304700, 'Lorie', 'Amoroso', 'Tac-an', 'BSIT', 3, 'A', 'lorietacan427@gmail.com', '09079182482', 'student'),
(2023304706, 'Arlyn Kaye Allona', 'Delos Santos', 'Baluyos', 'BSIT', 3, 'A', 'arlynbaluyos33@gmail.com', '09302903570', 'student'),
(2023304707, 'Jason', 'Sumile', 'Baroro', 'BSIT', 3, 'A', 'jasonbaroro5@gmail.com', '09510900990', 'student'),
(2023304766, 'Jastine Claire', 'Velasquez', 'Rullin', 'BSIT', 3, 'A', 'rullinjastinclaire@gmail.com', '09566726314', 'student'),
(2023304790, 'Maicah Colleine', 'Toledo', 'Pantua', 'BSIT', 3, 'A', 'maicahpantua17@gmail.com', '09454256483', 'student'),
(2023304792, 'Lenyvie', 'Taladtad', 'Pauyon', 'BSIT', 3, 'A', 'lenyviepauyon4@gmail.com', '09154589448', 'student'),
(2023304814, 'Gellyn', 'Sumagang', 'Rabino', 'BSIT', 3, 'A', 'gellynrabino5@gmail.com', '09639231903', 'student'),
(2023304823, 'Riza', 'Salubod', 'Tual', 'BSIT', 3, 'A', 'rizasalubodtual@gmail.com', '09060735573', 'student'),
(2023304832, 'Junjhey Brylle', '', 'Damas', 'BSIT', 3, 'A', 'junjhey@gmail.com', '09558451870', 'student'),
(2023305014, 'Kent Nicholas', 'Parnan', 'Carreon', 'BSIT', 3, 'A', 'kentcarreon19@gmail.com', '09663660466', 'student'),
(2023305025, 'Johny', 'Mutia', 'Roldan', 'BSIT', 3, 'A', 'johnyroldan86@gmail.com', '09516519480', 'student'),
(2023305026, 'John Kenneth', 'Mutia', 'Roldan', 'BSIT', 3, 'A', 'roldankenneth47@gmail.com', '09509720680', 'student'),
(2023305059, 'Jhon Peter', 'Udal', 'Codilla', 'BSIT', 3, 'A', 'romecodilla1@gmail.com', '09203510018', 'student'),
(2023305122, 'Jevi', 'Daque', 'Bantiad', 'BSIT', 3, 'A', 'jvbantiad@gmail.com', '09122911136', 'student'),
(2023305178, 'Mark Dave', 'Mondalo', 'Panaguiton', 'BSIT', 3, 'A', 'markdavepanaguiton12345@gmail.com', '09451409487', 'student'),
(2023305220, 'Aime Jean', 'Sumagang', 'Gumatay', 'BSIT', 3, 'A', 'gumatayaimejean@gmail.com', '09634794894', 'student'),
(2023305323, 'Frisel', 'Gumandoy', 'Lagane', 'BSIT', 3, 'A', 'frisellagane62@gmail.com', '09854623478', 'student'),
(2023306312, 'Mark Cyril', '', 'Sumoroy', 'BSIT', 3, 'A', 'sumoroymarkcyril@gmail.com', '09816894516', 'student'),
(2023306356, 'Ian Kirby', 'Bahian', 'Duman-ag', 'BSIT', 3, 'A', 'kdumz23@gmail.com', '09286232954', 'student'),
(2023306358, 'Jay Mark', 'Catane', 'Palania', 'BSIT', 3, 'A', 'palaniajaymark85@gmail.com', '09392750097', 'student');
