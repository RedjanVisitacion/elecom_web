-- PostgreSQL version of candidates_registration table

CREATE TABLE candidates_registration (
  id SERIAL PRIMARY KEY,
  student_id varchar(64) NOT NULL,
  first_name varchar(100) NOT NULL,
  middle_name varchar(100),
  last_name varchar(100) NOT NULL,
  organization varchar(100),
  position varchar(100),
  program varchar(100),
  year_section varchar(50),
  platform text,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  candidate_type varchar(20) DEFAULT 'Independent',
  party_name varchar(100),
  photo_url varchar(255),
  party_logo_url varchar(255),
  photo_blob bytea,
  photo_mime varchar(50),
  party_logo_blob bytea,
  party_logo_mime varchar(50),
  votes int DEFAULT 0,
  UNIQUE(student_id, organization, position)
);
