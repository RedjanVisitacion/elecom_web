-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Dec 12, 2025 at 03:14 PM
-- Server version: 8.0.44-0ubuntu0.24.04.1
-- PHP Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `societree`
--

-- --------------------------------------------------------

--
-- Table structure for table `access_announcement`
--

CREATE TABLE `access_announcement` (
  `announcement_id` int NOT NULL,
  `announcement_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `announcement_content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `announcement_datetime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `access_announcement`
--

INSERT INTO `access_announcement` (`announcement_id`, `announcement_title`, `announcement_content`, `announcement_datetime`, `created_by`, `status`) VALUES
(1, 'Urgent Meeting', 'magmeeting thi afternoon', '2025-12-03 05:11:47', NULL, 'Active'),
(2, 'Urgent Meeting', 'magmeeting thi afternoon', '2025-12-03 05:11:47', NULL, 'Inactive'),
(3, 'Meeting for Outreach campaign', 'unyanf hapon', '2025-12-03 05:14:04', NULL, 'Active'),
(4, 'Meeting for Outreach campaign', 'unyanf hapon', '2025-12-03 05:14:36', NULL, 'Inactive'),
(5, 'Meeting de Avance', 'hdfsj jedfhuf wyuruhf', '2025-12-03 07:32:18', NULL, 'Active');

-- --------------------------------------------------------

--
-- Table structure for table `access_feedback`
--

CREATE TABLE `access_feedback` (
  `feedback_id` int NOT NULL,
  `user_id` int NOT NULL,
  `feedback_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `feedback_text` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'New',
  `date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `access_gallery`
--

CREATE TABLE `access_gallery` (
  `gallery_id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `image_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `album` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `upload_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `access_learning_resource`
--

CREATE TABLE `access_learning_resource` (
  `resource_id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `resource_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `content_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `access_learning_resource`
--

INSERT INTO `access_learning_resource` (`resource_id`, `title`, `description`, `resource_type`, `content_url`, `file_path`, `created_by`, `created_date`, `status`) VALUES
(1, 'new learning', 'let meet on the venue', 'tutorial', NULL, NULL, NULL, '2025-12-03 07:16:45', 'Active');

-- --------------------------------------------------------

--
-- Table structure for table `access_service_request`
--

CREATE TABLE `access_service_request` (
  `request_id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `priority` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Normal',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Open',
  `requested_by` int DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `created_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completion_date` timestamp NULL DEFAULT NULL,
  `progress_percentage` int DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `afprotechs_announcements`
--

CREATE TABLE `afprotechs_announcements` (
  `announcement_id` int NOT NULL,
  `announcement_title` varchar(255) NOT NULL,
  `announcement_content` text NOT NULL,
  `announcement_datetime` datetime NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `afprotechs_announcements`
--

INSERT INTO `afprotechs_announcements` (`announcement_id`, `announcement_title`, `announcement_content`, `announcement_datetime`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Announcements For Everyone', 'Our system is currently undergoing scheduled server maintenance to improve performance, security, and stability. During this process, some features may be temporarily unavailable.\r\n\r\nWe are working to complete the maintenance as quickly as possible.\r\n\r\nStay tuned — please check back later.', '2025-12-12 12:00:00', 'pinned', '2025-12-10 12:59:04', '2025-12-12 05:34:28');

-- --------------------------------------------------------

--
-- Table structure for table `afprotechs_countdown`
--

CREATE TABLE `afprotechs_countdown` (
  `countdown_id` int NOT NULL,
  `countdown_title` varchar(255) NOT NULL,
  `countdown_description` text,
  `target_datetime` datetime NOT NULL,
  `countdown_type` varchar(50) DEFAULT 'event',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `afprotechs_countdown`
--

INSERT INTO `afprotechs_countdown` (`countdown_id`, `countdown_title`, `countdown_description`, `target_datetime`, `countdown_type`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-13 06:45:53', 'attendance', 0, '2025-12-12 05:45:55', '2025-12-12 06:02:55'),
(2, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:02:50', 'attendance', 0, '2025-12-12 06:02:56', '2025-12-12 06:03:03'),
(3, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:02:58', 'attendance', 0, '2025-12-12 06:03:03', '2025-12-12 06:03:05'),
(4, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:03:00', 'attendance', 0, '2025-12-12 06:03:05', '2025-12-12 06:04:07'),
(5, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:04:04', 'attendance', 0, '2025-12-12 06:04:07', '2025-12-12 06:04:09'),
(6, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:04:04', 'attendance', 0, '2025-12-12 06:04:10', '2025-12-12 06:04:10'),
(7, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:04:04', 'attendance', 0, '2025-12-12 06:04:10', '2025-12-12 06:04:13'),
(8, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:04:04', 'attendance', 0, '2025-12-12 06:04:10', '2025-12-12 06:04:13'),
(9, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:04:03', 'attendance', 0, '2025-12-12 06:04:14', '2025-12-12 06:04:17'),
(10, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 07:04:05', 'attendance', 0, '2025-12-12 06:04:17', '2025-12-12 06:06:54'),
(11, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:50', 'attendance', 0, '2025-12-12 06:06:55', '2025-12-12 06:06:55'),
(12, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:50', 'attendance', 0, '2025-12-12 06:06:55', '2025-12-12 06:06:56'),
(13, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:51', 'attendance', 0, '2025-12-12 06:06:56', '2025-12-12 06:06:56'),
(14, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:51', 'attendance', 0, '2025-12-12 06:06:56', '2025-12-12 06:06:58'),
(15, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:51', 'attendance', 0, '2025-12-12 06:06:58', '2025-12-12 06:06:59'),
(16, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:51', 'attendance', 0, '2025-12-12 06:07:02', '2025-12-12 06:09:24'),
(17, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:20', 'attendance', 0, '2025-12-12 06:09:24', '2025-12-12 06:09:25'),
(18, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:20', 'attendance', 0, '2025-12-12 06:09:24', '2025-12-12 06:09:25'),
(19, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:21', 'attendance', 0, '2025-12-12 06:09:25', '2025-12-12 06:09:26'),
(20, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:21', 'attendance', 0, '2025-12-12 06:09:25', '2025-12-12 06:09:26'),
(21, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:21', 'attendance', 0, '2025-12-12 06:09:26', '2025-12-12 06:09:31'),
(22, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:21', 'attendance', 0, '2025-12-12 06:09:26', '2025-12-12 06:09:31'),
(23, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:21', 'attendance', 0, '2025-12-12 06:09:32', '2025-12-12 06:09:40'),
(24, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:39:27', 'attendance', 0, '2025-12-12 06:09:42', '2025-12-12 06:11:31'),
(25, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:27', 'attendance', 0, '2025-12-12 06:11:32', '2025-12-12 06:11:32'),
(26, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:36:28', 'attendance', 0, '2025-12-12 06:11:32', '2025-12-12 06:14:47'),
(27, 'ATTENDANCE COUNTDOWN', 'Time remaining for attendance submission', '2025-12-12 06:44:43', 'attendance', 1, '2025-12-12 06:14:47', '2025-12-12 06:14:47');

-- --------------------------------------------------------

--
-- Table structure for table `afprotechs_events`
--

CREATE TABLE `afprotechs_events` (
  `event_id` int NOT NULL,
  `event_title` varchar(255) NOT NULL,
  `event_description` text,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `event_location` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `afprotechs_events`
--

INSERT INTO `afprotechs_events` (`event_id`, `event_title`, `event_description`, `start_date`, `end_date`, `event_location`, `created_at`) VALUES
(1, 'INTRAMURALS 2026', 'Intramurals 2025 is the annual athletic and team-building celebration bringing together students, faculty, and staff for a week-long showcase of sportsmanship, talent, and school spirit.\r\nThis year features new sports, enhanced scoring, and interactive activities for all participants.\r\n\r\n🎯 Objectives\r\n\r\nPromote teamwork and camaraderie\r\n\r\nEncourage physical fitness and healthy competition\r\n\r\nStrengthen school spirit and community involvement\r\n\r\nDiscover and develop student athletic talent\r\n\r\n🏟️ Featured Sports & Activities\r\nMajor Sports\r\n\r\nBasketball (Men/Women)\r\n\r\nVolleyball (Men/Women)\r\n\r\nBadminton (Singles/Doubles)\r\n\r\nTable Tennis\r\n\r\nChess\r\n\r\nAthletics (Track & Field Events)\r\n\r\nFun Games\r\n\r\nTug of War\r\n\r\nObstacle Course\r\n\r\nSack Race\r\n\r\nRelay Games\r\n\r\nShowcase Events\r\n\r\nCheer Dance Competition\r\n\r\nMr. & Ms. Intramurals 2025\r\n\r\nDrum & Lyre Exhibition\r\n\r\nTorch Lighting Ceremony\r\n\r\n📌 Important Dates\r\n\r\nOpening Ceremony: February 10, 2025\r\n\r\nGame Schedule: February 10–15, 2025\r\n\r\nCheerdance Finals: February 12, 2025\r\n\r\nChampionship Day: February 15, 2025\r\n\r\nAwarding Ceremony: February 15, 2025 (Evening)\r\n\r\n🏅 Scoring System\r\n\r\n1st Place – 100 points\r\n\r\n2nd Place – 70 points\r\n\r\n3rd Place – 50 points\r\n\r\n4th Place – 30 points\r\n\r\nParticipation – 10 points each event\r\n\r\n📣 Announcements\r\n\r\nFull game schedule will be posted 1 week before the event.\r\n\r\nAll players must present ID and wear official team uniforms.\r\n\r\nMedical staff will be on standby throughout the intramurals.\r\n\r\nWeather delays will be announced on the official page.\r\n\r\n📷 Media & Documentation\r\n\r\nA dedicated media team will cover all events. Photos and results will be uploaded daily on the school platform.', '2025-12-01', '2025-12-05', 'USTP,Mobod', '2025-12-10 12:58:04'),
(2, 'BINSOY DAYS', 'AsSsAS', '2025-12-01', '2025-12-12', 'USTP,Mobod', '2025-12-12 03:00:19');

-- --------------------------------------------------------

--
-- Table structure for table `arts_announcements`
--

CREATE TABLE `arts_announcements` (
  `id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `club` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `arts_announcements`
--

INSERT INTO `arts_announcements` (`id`, `title`, `body`, `club`, `created_at`, `status`) VALUES
(1, 'G-CLEF Recruitment', 'try try try tyr', 'G-CLEF', '2025-12-05 09:17:23', 'active'),
(2, 'Fashion Icon General Assembly', 'All members are invited to our GA this Saturday. Dress to express!', 'Fashion Icon', '2025-12-05 09:17:23', 'active'),
(3, 'LGDC Fucking Camp', 'Join our weekend camp and learn core leadership and facilitation skills.', 'LGDC', '2025-12-05 09:17:23', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `arts_clubs`
--

CREATE TABLE `arts_clubs` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `members_count` int DEFAULT '0',
  `logo_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `arts_clubs`
--

INSERT INTO `arts_clubs` (`id`, `name`, `description`, `members_count`, `logo_url`, `created_at`, `status`) VALUES
(2, 'Fashion Icon', 'Express yourself through fashion', 38, NULL, '2025-12-05 09:17:23', 'active'),
(3, 'LGDCAUSDUASDBASUBDASJDN', 'Leadership and development', 52, NULL, '2025-12-05 09:17:23', 'active'),
(4, 'Himig Malaya', 'Music and performance group', 41, NULL, '2025-12-05 09:17:23', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `arts_club_applications`
--

CREATE TABLE `arts_club_applications` (
  `id` int NOT NULL,
  `user_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `club_id` int NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `arts_events`
--

CREATE TABLE `arts_events` (
  `id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date` date NOT NULL,
  `time` time DEFAULT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `image_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'upcoming'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `arts_events`
--

INSERT INTO `arts_events` (`id`, `title`, `description`, `date`, `time`, `location`, `image_url`, `created_at`, `status`) VALUES
(1, 'Orientation Day day day day', 'Welcome new students to our Arts & Culture community.', '2025-12-07', '09:00:00', 'Main Auditorium', NULL, '2025-12-05 09:17:23', 'upcoming'),
(2, 'Club Fairy', 'Explore all clubs and sign up for the ones you love.', '2025-12-10', '10:00:00', 'Activity Center', NULL, '2025-12-05 09:17:23', 'upcoming'),
(3, 'Music day', 'An evening of performances from Himig Malaya & friends.', '2025-12-15', '18:00:00', 'Open Grounds', NULL, '2025-12-05 09:17:23', 'upcoming'),
(4, 'balo', 'char char', '2025-12-10', '18:00:00', 'plaza', '', '2025-12-11 17:25:08', 'upcoming'),
(5, 'balo', 'char char', '2025-12-10', '18:00:00', 'plaza', '', '2025-12-11 17:25:33', 'upcoming');

-- --------------------------------------------------------

--
-- Table structure for table `arts_feedback`
--

CREATE TABLE `arts_feedback` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'new'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `arts_messages`
--

CREATE TABLE `arts_messages` (
  `id` int NOT NULL,
  `user_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `arts_messages`
--

INSERT INTO `arts_messages` (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at`) VALUES
(1, '2023304637', 'Application Approved!', 'Congratulations! Your application to join G-CLIFF has been approved. Welcome to the team!', 'success', 0, '2025-12-05 09:17:23'),
(2, '2023304637', 'Event Reminder', 'Don\'t forget: Music Night is happening tomorrow at 6 PM in the Open Grounds.', 'info', 0, '2025-12-05 09:17:23'),
(3, '2023304637', 'Application Pending', 'Your application to Fashion Icon is currently under review. We will notify you soon.', 'warning', 1, '2025-12-05 09:17:23');

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `id` int UNSIGNED NOT NULL,
  `student_id` varchar(64) NOT NULL,
  `event_id` int UNSIGNED DEFAULT NULL,
  `organization` varchar(64) NOT NULL DEFAULT 'afprotechs',
  `attendance_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `candidates_registration`
--

CREATE TABLE `candidates_registration` (
  `id` int UNSIGNED NOT NULL,
  `student_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `middle_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `organization` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `position` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `program` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `year_section` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `platform` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `candidate_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `party_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `photo_url` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `party_logo_url` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `photo_blob` longblob,
  `photo_mime` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `party_logo_blob` longblob,
  `party_logo_mime` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `votes` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `candidates_registration`
--

INSERT INTO `candidates_registration` (`id`, `student_id`, `first_name`, `middle_name`, `last_name`, `organization`, `position`, `program`, `year_section`, `platform`, `created_at`, `candidate_type`, `party_name`, `photo_url`, `party_logo_url`, `photo_blob`, `photo_mime`, `party_logo_blob`, `party_logo_mime`, `votes`) VALUES
(101, '2023304637', 'Redjan Phil', 'S.', 'Visitacion', 'USG', 'BSIT Representative', 'BSIT', 'BSIT-3A', 'I want to help IT students in basic programming, especially the FRESMEN\'S', '2025-12-08 04:54:13', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765169650/elecom/candidates/f7lfbkykearpylcm1nac.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765169652/elecom/parties/i4mtmfkkddqgazsbfxai.png', NULL, NULL, NULL, NULL, 5),
(102, '2024304258', 'Jude Arom', 'F.', 'Dominguez', 'SITE', 'President', 'BSIT', 'BSIT-2C', 'I want to help', '2025-12-08 09:11:25', 'Political Party', 'IT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765185082/elecom/candidates/lcllirfh4v6mwtruxyw8.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765185084/elecom/parties/tcicuppygvzbwehzvyst.png', NULL, NULL, NULL, NULL, 7),
(103, '2024304336', 'Elton Jay', 'S.', 'Pasco', 'SITE', 'Vice President', 'BSIT', 'BSIT-2C', 'I want to help', '2025-12-08 09:18:02', 'Political Party', 'IT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765185479/elecom/candidates/tbtacsywirlgnsdwalck.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765185481/elecom/parties/o2zq4ol9g4u9stjjilqh.png', NULL, NULL, NULL, NULL, 7),
(104, '2024303781', 'Cheny Lou', '', 'Vibar', 'SITE', 'General Secretary', 'BSIT', 'BSIT-2C', 'I want to help', '2025-12-08 09:34:39', 'Political Party', 'IT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765186473/elecom/candidates/nsn6ihvamgjit748lbb1.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765186476/elecom/parties/czb2wgptobu9ltyyg09n.png', NULL, NULL, NULL, NULL, 7),
(105, '2024303250', 'Therese Katrina', 'C.', 'Baculi', 'SITE', 'Associate Secretary', 'BSIT', 'BSIT-2A', 'I want to help', '2025-12-08 09:40:49', 'Political Party', 'IT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765186846/elecom/candidates/vzphn8mkbqsgfmmtmrlt.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765186848/elecom/parties/da7ppjec3vozg1p0sfae.png', NULL, NULL, NULL, NULL, 7),
(106, '2024303288', 'Christine', 'L.', 'Acla', 'SITE', 'Treasurer', 'BSIT', 'BSIT-2E', 'I want to help', '2025-12-08 09:49:22', 'Political Party', 'IT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765187359/elecom/candidates/h5ih49mlcgybe3d8oo9d.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765187361/elecom/parties/wriyxk8axsdpstglofar.png', NULL, NULL, NULL, NULL, 7),
(107, '2024303244', 'Eleazer', 'J.', 'Cinco', 'SITE', 'Auditor', 'BSIT', 'BSIT-2A', 'I want to help', '2025-12-08 09:52:45', 'Political Party', 'IT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765187559/elecom/candidates/mdgj5oxviwkrobdzkvbt.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765187563/elecom/parties/th7b35sxhlhzyzdn8x44.png', NULL, NULL, NULL, NULL, 7),
(108, '2024305893', 'Christ Jissel', 'L.', 'Roxas', 'SITE', 'Public Information Officer', 'BSIT', 'BSIT-2C', 'I want to help', '2025-12-08 09:58:12', 'Political Party', 'IT', 'https://scontent.fceb6-4.fna.fbcdn.net/v/t39.30808-6/557601577_2022011861912425_1249232954009872182_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeE43NDV_q7YstzBKGtLcIc833VdzuC9TmDfdV3O4L1OYIlq_uNFxnvC1Rf7bg5trZaOx3uefwDhLuC_CuP2J62s&_nc_ohc=f75Ubw_EEwIQ7kNvwFJTiTi&_nc_oc=AdlQNw5W1gqPji8CiUHhpstO7R5oVuboxOAP9wy8xoG2satJZlKf5KzRcND-LlCrQV0&_nc_zt=23&_nc_ht=scontent.fceb6-4.fna&_nc_gid=j2za70NQBSOjyfkW57JVCQ&oh=00_Afk92xaFGxhcunNGGOizQ6kKVueIBoghF0y5FljGGpdxEw&oe=693C8755', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765187890/elecom/parties/kfyc0rz0wyyski9oyxaj.png', NULL, NULL, NULL, NULL, 7),
(109, '2022311745', 'Evan John', 'S.', 'Dago-oc', 'USG', 'President', 'BSIT', 'BSIT-3D', 'I want to help', '2025-12-08 10:04:24', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765188260/elecom/candidates/iny83pcoa5il68wcnjpo.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765188263/elecom/parties/dixqcwvm3wzb7tkrxymo.png', NULL, NULL, NULL, NULL, 6),
(110, '2024303758', 'Kenneth', 'C.', 'Lumasag', 'USG', 'Vice President', 'BSIT', 'BSIT-2B', 'I want to help', '2025-12-08 10:07:42', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765188459/elecom/candidates/gv4qcktadqrxec3yabdd.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765188461/elecom/parties/zz0zwoyymptx1jpbnu7a.png', NULL, NULL, NULL, NULL, 3),
(111, '2024303209', 'Karl Luis', 'R.', 'Bogahod', 'USG', 'General Secretary', 'BSIT', 'BSIT-2A', 'I want to help', '2025-12-08 10:10:29', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765188627/elecom/candidates/rnmmhrtojxxjuakbr8os.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765188629/elecom/parties/ckdweigzp144yhuur6cw.png', NULL, NULL, NULL, NULL, 7),
(112, '2024303759', 'Jelian', 'M.', 'Ronquillo', 'USG', 'Associate Secretary', 'BTLED', 'BTLED-IA-1A', 'I want to help', '2025-12-08 10:18:21', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765189097/elecom/candidates/j8umdyfzeaopo0vuzl9b.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765189099/elecom/parties/bhmurzm4ucgonsrhobmq.png', NULL, NULL, NULL, NULL, 7),
(113, '2023305987', 'Jovy Jane', 'B.', 'Matulin', 'USG', 'Treasurer', 'BFPT', 'BFPT-3A', 'I want to help', '2025-12-08 10:26:02', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765189559/elecom/candidates/uemnuipuz1ani8zwco4e.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765189561/elecom/parties/d4e0dtwmpzkqq80zo2ux.png', NULL, NULL, NULL, NULL, 7),
(114, '2023304616', 'Dann Kristoffer', 'D.', 'Zapitan', 'USG', 'Auditor', 'BSIT', 'BSIT-3D', 'I want to help', '2025-12-08 10:29:59', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765189796/elecom/candidates/ehdca1hrh5ljyevh5e2v.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765189798/elecom/parties/o7ypwtm2nmwftycywnjj.png', NULL, NULL, NULL, NULL, 7),
(115, '2023305946', 'Samantha Nicole', 'Q.', 'Tanallon', 'USG', 'Public Information Officer', 'BFPT', 'BFPT-3C', 'I want to help', '2025-12-08 10:33:33', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765190010/elecom/candidates/dy7e2qzrrxpkjbb4brav.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765190012/elecom/parties/fjepynx3kncbdewhz9c1.png', NULL, NULL, NULL, NULL, 7),
(116, '2023305322', 'Jude Esidore', 'Z.', 'Jariol', 'USG', 'BSIT Representative', 'BSIT', 'BSIT-3C', 'I want to help', '2025-12-08 10:38:35', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765190311/elecom/candidates/bjhuemlq96toy8uwvv8n.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765190315/elecom/parties/r09swzon18f9ehiwpid8.png', NULL, NULL, NULL, NULL, 5),
(117, '2024303736', 'John Russel', 'P.', 'Cabilogan', 'USG', 'BTLED Representative', 'BTLED', 'BTLED-IA-2A', 'I want to help', '2025-12-08 10:50:44', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191039/elecom/candidates/hbaxcrhsoeuqlrsgrbeq.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191043/elecom/parties/rohii8ym0qf57e0wnziq.jpg', NULL, NULL, NULL, NULL, 1),
(118, '2023305241', 'Leah', 'D.', 'Sumalpong', 'USG', 'BTLED Representative', 'BTLED', 'BTLED-HE-3A', 'I want to help', '2025-12-08 10:52:56', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191172/elecom/candidates/neyt2ivyw6ghpzejbltb.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191175/elecom/parties/v3ruf36kjqatkya9jz0m.png', NULL, NULL, NULL, NULL, 6),
(119, '2022310531', 'Medelyn', 'M.', 'Ocay', 'USG', 'BFPT Representative', 'BFPT', 'BFPT-2A', 'I want to help', '2025-12-08 10:56:33', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191389/elecom/candidates/ei22nbkgros3gssny9ru.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191391/elecom/parties/p6lqhma2cgpeiqku1ohx.png', NULL, NULL, NULL, NULL, 1),
(120, '2023305004', 'Leonisa', 'L.', 'Montejo', 'USG', 'BFPT Representative', 'BFPT', 'BFPT-3A', 'I want to help', '2025-12-08 10:58:55', 'Political Party', 'UNITE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191531/elecom/candidates/nnadsmiyenansc8pkpcq.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765191533/elecom/parties/ssyfqqgycaqldzoxhpqi.png', NULL, NULL, NULL, NULL, 6),
(121, '2021309577', 'Wabel', NULL, 'Calabio', 'AFPROTECHS', 'President', 'BFPT', 'BFPT-2B', 'I want to help', '2025-12-08 11:08:00', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765192078/elecom/candidates/trcbhiausgr2i2ojllcn.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765192080/elecom/parties/zodwurqyw8nsq1u78nat.png', NULL, NULL, NULL, NULL, 0),
(122, '2023305829', 'Cristian', NULL, 'Magamaya', 'AFPROTECHS', 'Vice President', 'BFPT', 'BFPT-2B', 'I want to help', '2025-12-08 11:25:52', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193147/elecom/candidates/qbfuisf19nwbsqjcgpg7.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193152/elecom/parties/zqhdmdyxlhgaupb9mlbo.png', NULL, NULL, NULL, NULL, 0),
(123, '2024304192', 'Andrea Marie', 'A.', 'Bailon', 'AFPROTECHS', 'General Secretary', 'BFPT', 'BFPT-2A', 'I want to help', '2025-12-08 11:29:47', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193376/elecom/candidates/nsrevupenmggjpbbtmfx.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193386/elecom/parties/yeuntioq5bdhzgfses0q.png', NULL, NULL, NULL, NULL, 0),
(124, '2024304193', 'Jessel', NULL, 'Aya-ay', 'AFPROTECHS', 'Associate Secretary', 'BFPT', 'BFPT-2A', 'I want to help', '2025-12-08 11:31:39', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193494/elecom/candidates/nubuh534vsprxkcigdhx.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193498/elecom/parties/zroicz1zwrwctya1uv59.png', NULL, NULL, NULL, NULL, 0),
(125, '2023306641', 'Whingky', 'J.', 'Carbon', 'AFPROTECHS', 'Treasurer', 'BFPT', 'BFPT-3A', 'I want to help', '2025-12-08 11:34:40', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193675/elecom/candidates/t34y5bncp19dedd5dg8y.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193678/elecom/parties/jtjtbpyhebadzfo1mpv7.png', NULL, NULL, NULL, NULL, 0),
(126, '2023304785', 'Princess', 'B.', 'Castillano', 'AFPROTECHS', 'Auditor', 'BFPT', 'BFPT-3B', 'I want to help', '2025-12-08 11:37:12', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193829/elecom/candidates/i9jyu6lrhxzg36j3lghk.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765193831/elecom/parties/ywogre1tkv9bjrhe22sr.png', NULL, NULL, NULL, NULL, 0),
(127, '2023305834', 'Mitchiee', 'A.', 'Tañcao', 'AFPROTECHS', 'Public Information Officer', 'BFPT', 'BFPT-2B', 'I want to help', '2025-12-08 11:43:05', 'Political Party', 'FPT', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194182/elecom/candidates/w3vvkmcjnilfczg0wjbs.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194184/elecom/parties/sxirzzeehwthycnvh6sx.png', NULL, NULL, NULL, NULL, 0),
(128, '2023305008', 'Edward', 'C.', 'Duma-og', 'PAFE', 'President', 'BTLED', 'BTLED-IA-3A', 'I want to help', '2025-12-08 11:46:41', 'Political Party', 'TLE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194397/elecom/candidates/cy9w6uhvz5qumfzomj6q.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194399/elecom/parties/k7jhtm38il3hvdkeulau.png', NULL, NULL, NULL, NULL, 0),
(129, '2023304899', 'Glizy Mae', 'M.', 'Abarquez', 'PAFE', 'Vice President', 'BTLED', 'BTLED-IA-3A', 'I want to help', '2025-12-08 11:48:41', 'Political Party', 'TLE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194513/elecom/candidates/ynfyordkf36epgpvpi6x.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194520/elecom/parties/ynordewi7elvpxipkhuu.png', NULL, NULL, NULL, NULL, 0),
(130, '2023305030', 'Ira Claire', 'A.', 'Mangao', 'PAFE', 'General Secretary', 'BTLED', 'BTLED-ICT-3A', 'I want to help', '2025-12-08 11:51:11', 'Political Party', 'TLE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194664/elecom/candidates/ezgemkp2uhnfdtonuzs3.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194669/elecom/parties/vthpno60txmqnjyzrhtm.png', NULL, NULL, NULL, NULL, 0),
(131, '2023304826', 'Laicel', 'T.', 'Malay', 'PAFE', 'Associate Secretary', 'BTLED', 'BTLED-ICT-3A', 'I want to help', '2025-12-08 11:53:56', 'Political Party', 'TLE', NULL, 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765194835/elecom/parties/qsne4anqjo9tib0rbsek.png', NULL, NULL, NULL, NULL, 0),
(132, '2023304825', 'Chynna', 'M.', 'Indonto', 'PAFE', 'Treasurer', 'BTLED', 'BTLED-ICT-3A', 'I want to help', '2025-12-08 11:56:48', 'Political Party', 'TLE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765195003/elecom/candidates/p3xwg8qpzi0zrj01qbww.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765195007/elecom/parties/goeyafd2o8krugkbkwat.png', NULL, NULL, NULL, NULL, 0),
(133, '2024303228', 'John Ceasar', 'S.', 'Maglinte', 'PAFE', 'Auditor', 'BTLED', 'BTLED-IA-2A', 'I want to help', '2025-12-08 12:02:21', 'Political Party', 'TLE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765195335/elecom/candidates/f8b3tbzsdvsxjyr5qxtl.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765195338/elecom/parties/rounq9djyvjy3arr5pmv.png', NULL, NULL, NULL, NULL, 0),
(134, '2023304773', 'Diozen John', 'L.', 'bregoños', 'PAFE', 'Public Information Officer', 'BTLED', 'BTLED-ICT-3A', 'I want to help', '2025-12-08 12:04:57', 'Political Party', 'TLE', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765195492/elecom/candidates/q05vwg97anenq9odteod.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765195496/elecom/parties/ovvirhfyinrwcm1jwnr4.png', NULL, NULL, NULL, NULL, 0),
(136, '2023306358', 'Jay Mark', 'C.', 'Palania', 'USG', 'Vice President', 'BSIT', 'BSIT-3A', 'Maintain Cleanleness', '2025-12-10 15:01:28', 'Political Party', 'IT Partylst', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765378804/elecom/candidates/t4mxfcnkpl7bwy3fsl0z.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765378887/elecom/parties/nc4cfkmkdlhp6zsrz6o0.png', NULL, NULL, NULL, NULL, 4),
(137, '2022310650', 'Kurt', 'B.', 'Mabalod', 'USG', 'President', 'BSIT', 'BSIT-3A', 'Secret', '2025-12-12 00:17:08', 'Political Party', 'PDP', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765498622/elecom/candidates/mp1m8jgfypnnchhc9wut.jpg', 'https://res.cloudinary.com/dhhzkqmso/image/upload/v1765498626/elecom/parties/akxn8x9vmhbc9ho23x1s.jpg', NULL, NULL, NULL, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `chat_auto_responses`
--

CREATE TABLE `chat_auto_responses` (
  `id` int NOT NULL,
  `trigger_pattern` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `response_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_auto_responses`
--

INSERT INTO `chat_auto_responses` (`id`, `trigger_pattern`, `response_text`, `category`, `is_active`, `created_at`) VALUES
(1, 'hello', 'Hi there! I\'m the SITE chat assistant. What can I do for you?', 'greeting', 1, '2025-12-11 06:29:28'),
(2, 'hi', 'Hello! Welcome to SITE chat. How can I help you today?', 'greeting', 1, '2025-12-11 06:29:28'),
(3, 'hey', 'Hi there! I\'m the SITE chat assistant. What can I do for you?', 'greeting', 1, '2025-12-11 06:29:29'),
(4, 'good morning', 'Hello! Welcome to SITE chat. How can I help you today?', 'greeting', 1, '2025-12-11 06:29:29'),
(5, 'good afternoon', 'Hello! Welcome to SITE chat. How can I help you today?', 'greeting', 1, '2025-12-11 06:29:29'),
(6, 'good evening', 'Hello! Welcome to SITE chat. How can I help you today?', 'greeting', 1, '2025-12-11 06:29:29'),
(7, 'help', 'How can I assist you today? Feel free to ask about SITE services or events!', 'help', 1, '2025-12-11 06:29:30'),
(8, 'assist', 'I\'m here to help! You can ask me about SITE events, announcements, or general information.', 'help', 1, '2025-12-11 06:29:30'),
(9, 'support', 'Need assistance? I can help with information about our organization and activities.', 'help', 1, '2025-12-11 06:29:30'),
(10, 'how to', 'I\'m here to help! You can ask me about SITE events, announcements, or general information.', 'help', 1, '2025-12-11 06:29:31'),
(11, 'what is', 'Need assistance? I can help with information about our organization and activities.', 'help', 1, '2025-12-11 06:29:31'),
(12, 'explain', 'How can I assist you today? Feel free to ask about SITE services or events!', 'help', 1, '2025-12-11 06:29:31'),
(13, 'event', 'Stay updated with our latest events and activities in the Events module.', 'events', 1, '2025-12-11 06:29:32'),
(14, 'activity', 'We have exciting events planned! Visit the Events section for more details.', 'events', 1, '2025-12-11 06:29:32'),
(15, 'meeting', 'We have exciting events planned! Visit the Events section for more details.', 'events', 1, '2025-12-11 06:29:32'),
(16, 'workshop', 'We have exciting events planned! Visit the Events section for more details.', 'events', 1, '2025-12-11 06:29:32'),
(17, 'seminar', 'We have exciting events planned! Visit the Events section for more details.', 'events', 1, '2025-12-11 06:29:33'),
(18, 'conference', 'We have exciting events planned! Visit the Events section for more details.', 'events', 1, '2025-12-11 06:29:33'),
(19, 'service', 'SITE offers various services to students. Check our Services page for details!', 'services', 1, '2025-12-11 06:29:33'),
(20, 'offer', 'SITE offers various services to students. Check our Services page for details!', 'services', 1, '2025-12-11 06:29:34'),
(21, 'provide', 'SITE offers various services to students. Check our Services page for details!', 'services', 1, '2025-12-11 06:29:34'),
(22, 'available', 'Our organization offers great services for technology enthusiasts!', 'services', 1, '2025-12-11 06:29:34'),
(23, 'facility', 'We provide multiple services for IT students. Visit the Services section to learn more.', 'services', 1, '2025-12-11 06:29:35'),
(24, 'thank', 'Anytime! Feel free to reach out if you need more help.', 'thanks', 1, '2025-12-11 06:29:35'),
(25, 'thanks', 'Anytime! Feel free to reach out if you need more help.', 'thanks', 1, '2025-12-11 06:29:35'),
(26, 'appreciate', 'You\'re welcome! Happy to help!', 'thanks', 1, '2025-12-11 06:29:36'),
(27, 'grateful', 'Glad I could assist you!', 'thanks', 1, '2025-12-11 06:29:36');

-- --------------------------------------------------------

--
-- Table structure for table `chat_message_analysis`
--

CREATE TABLE `chat_message_analysis` (
  `id` int NOT NULL,
  `message_id` int NOT NULL,
  `sentiment_score` decimal(3,2) DEFAULT '0.00',
  `keywords` json DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `flagged` tinyint(1) DEFAULT '0',
  `flag_reason` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `analyzed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `chat_notifications`
--

CREATE TABLE `chat_notifications` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `message` text COLLATE utf8mb4_general_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `chat_statistics`
--

CREATE TABLE `chat_statistics` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `messages_sent` int DEFAULT '0',
  `messages_received` int DEFAULT '0',
  `last_active` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `total_words` int DEFAULT '0',
  `avg_response_time` int DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_statistics`
--

INSERT INTO `chat_statistics` (`id`, `student_id`, `messages_sent`, `messages_received`, `last_active`, `total_words`, `avg_response_time`) VALUES
(1, 2023306358, 3, 0, '2025-12-11 06:38:22', 0, 0),
(4, 2023305122, 2, 0, '2025-12-11 06:49:17', 0, 0),
(6, 2023304665, 1, 0, '2025-12-11 06:50:24', 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `date` date DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `organizer` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`id`, `title`, `description`, `date`, `start_time`, `end_time`, `location`, `organizer`, `created_at`) VALUES
(1, 'Test Event', 'This is a test event', '2025-12-07', '14:00:00', '15:00:00', 'Test Location', 'Test Organizer', '2025-12-07 23:38:03');

-- --------------------------------------------------------

--
-- Table structure for table `pafe_announcements`
--

CREATE TABLE `pafe_announcements` (
  `id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `announcement_date` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `pafe_announcements`
--

INSERT INTO `pafe_announcements` (`id`, `title`, `description`, `announcement_date`, `created_at`, `updated_at`) VALUES
(4, 'Intramurals 2025', 'Enjoy this intramurals for student', '2025-12-10 21:15:00', '2025-12-10 13:15:49', '2025-12-10 13:15:49');

-- --------------------------------------------------------

--
-- Table structure for table `pafe_events`
--

CREATE TABLE `pafe_events` (
  `id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `event_date` date NOT NULL,
  `event_time` time NOT NULL,
  `location` varchar(255) NOT NULL,
  `morning_session_locked` tinyint(1) DEFAULT '0',
  `afternoon_session_locked` tinyint(1) DEFAULT '0',
  `qr_code_data` varchar(500) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `auto_lock_enabled` tinyint(1) DEFAULT '0',
  `morning_auto_lock_time` time DEFAULT NULL,
  `afternoon_auto_lock_time` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `pafe_events`
--

INSERT INTO `pafe_events` (`id`, `title`, `event_date`, `event_time`, `location`, `morning_session_locked`, `afternoon_session_locked`, `qr_code_data`, `created_at`, `updated_at`, `auto_lock_enabled`, `morning_auto_lock_time`, `afternoon_auto_lock_time`) VALUES
(1, 'BTLED DAYS', '2025-12-11', '21:26:00', 'Ustp', 1, 0, 'PAFE_EVENT_ID:1:PAFE_EVENT:1765373087:2417cb19659550a8595991452deb4e6f', '2025-12-10 13:24:48', '2025-12-11 06:19:54', 0, NULL, NULL),
(2, 'IT', '2025-12-10', '22:00:00', 'Ustp', 1, 1, 'PAFE_EVENT_ID:2:PAFE_EVENT:1765374074:4e91be32b80938ec20cc3db6e04a5061', '2025-12-10 13:41:15', '2025-12-10 13:47:14', 1, '07:00:00', '21:43:00');

-- --------------------------------------------------------

--
-- Table structure for table `pafe_event_attendance`
--

CREATE TABLE `pafe_event_attendance` (
  `id` int NOT NULL,
  `event_id` int NOT NULL,
  `student_id` int NOT NULL,
  `session_type` enum('morning','afternoon') NOT NULL,
  `status` enum('pending','approved','declined') DEFAULT 'pending',
  `attended_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pafe_feedback`
--

CREATE TABLE `pafe_feedback` (
  `id` int NOT NULL,
  `student_id` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `rating` int DEFAULT NULL,
  `status` enum('unread','read','replied') DEFAULT 'unread',
  `admin_reply` text,
  `replied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `redcross_activities`
--

CREATE TABLE `redcross_activities` (
  `id` int NOT NULL,
  `member_id` int NOT NULL,
  `activity_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `activity_date` date NOT NULL,
  `hours` decimal(5,2) NOT NULL DEFAULT '0.00',
  `remarks` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `redcross_activities`
--

INSERT INTO `redcross_activities` (`id`, `member_id`, `activity_name`, `activity_date`, `hours`, `remarks`) VALUES
(1, 1, 'first Aid', '2025-12-01', '2.00', 'good'),
(2, 1, 'first Aid', '2025-12-01', '20.00', 'good');

-- --------------------------------------------------------

--
-- Table structure for table `redcross_announcements`
--

CREATE TABLE `redcross_announcements` (
  `id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `redcross_announcements`
--

INSERT INTO `redcross_announcements` (`id`, `title`, `body`, `scheduled_at`, `created_at`) VALUES
(1, 'Urgent Meeting', 'ali mos covered court', '2025-12-03 16:40:00', '2025-12-02 14:39:10');

-- --------------------------------------------------------

--
-- Table structure for table `redcross_campaigns`
--

CREATE TABLE `redcross_campaigns` (
  `id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `image_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `event_link` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `views` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `redcross_campaigns`
--

INSERT INTO `redcross_campaigns` (`id`, `title`, `description`, `image_path`, `event_link`, `created_at`, `views`) VALUES
(1, 'coastal clean-up', 'coastal clean-up at punta-blanca bay', 'assets/img/1764601534_WIN_20250408_12_16_15_Pro.jpg', '', '2025-12-01 23:05:34', 3);

-- --------------------------------------------------------

--
-- Table structure for table `redcross_certificates`
--

CREATE TABLE `redcross_certificates` (
  `id` int NOT NULL,
  `member_id` int NOT NULL,
  `total_hours` decimal(5,2) NOT NULL,
  `issued_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `redcross_certificates`
--

INSERT INTO `redcross_certificates` (`id`, `member_id`, `total_hours`, `issued_at`) VALUES
(1, 1, '22.00', '2025-12-01 23:02:28'),
(2, 1, '22.00', '2025-12-01 23:41:02'),
(3, 1, '22.00', '2025-12-05 00:34:22');

-- --------------------------------------------------------

--
-- Table structure for table `redcross_members`
--

CREATE TABLE `redcross_members` (
  `id` int NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `id_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `department` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year_level` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `redcross_members`
--

INSERT INTO `redcross_members` (`id`, `full_name`, `id_number`, `department`, `year_level`, `email`, `phone`, `status`, `created_at`) VALUES
(1, 'Jason Baroro', '2023304707', 'BSIT', '3', 'jasonbaroro4@gmail.com', '09510900990', 'approved', '2025-12-01 23:00:22'),
(2, 'Arlyn Baluyos', '2023304706', 'BSIT', '3', 'arlynbaluyos@gmail.com', '09973357959', 'approved', '2025-12-02 00:11:49');

-- --------------------------------------------------------

--
-- Table structure for table `redcross_patients`
--

CREATE TABLE `redcross_patients` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `age` int DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `case_description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `date_of_service` date NOT NULL,
  `remarks` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `redcross_patients`
--

INSERT INTO `redcross_patients` (`id`, `name`, `age`, `address`, `case_description`, `date_of_service`, `remarks`, `created_at`) VALUES
(1, 'JASON BARORO', 20, 'upper lamac', 'fainted due over fatigue', '2025-12-01', 'good, recovering', '2025-12-01 23:54:27');

-- --------------------------------------------------------

--
-- Table structure for table `site_attendance`
--

CREATE TABLE `site_attendance` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `morning_in` time DEFAULT NULL,
  `morning_out` time DEFAULT NULL,
  `afternoon_in` time DEFAULT NULL,
  `afternoon_out` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `event_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_chat`
--

CREATE TABLE `site_chat` (
  `id` int NOT NULL,
  `student_id` int NOT NULL,
  `message` text COLLATE utf8mb4_general_ci NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_admin` tinyint(1) DEFAULT '0',
  `reply_to` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `site_chat`
--

INSERT INTO `site_chat` (`id`, `student_id`, `message`, `timestamp`, `is_admin`, `reply_to`) VALUES
(1, 2023306358, 'sagdhashd', '2025-12-11 06:26:26', 0, NULL),
(2, 2023306358, 'sadsa', '2025-12-11 06:29:27', 0, NULL),
(3, 2023306358, 'fsadas', '2025-12-11 06:29:56', 0, NULL),
(5, 2023306358, 'dsasd', '2025-12-11 06:38:20', 0, NULL),
(6, 2023305122, 'djncjnjzxn', '2025-12-11 06:48:51', 1, NULL),
(7, 2023305122, 'bn nbb', '2025-12-11 06:49:16', 1, NULL),
(8, 2023304665, 'jnxjnzc', '2025-12-11 06:50:23', 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `site_chat_messages`
--

CREATE TABLE `site_chat_messages` (
  `id` int NOT NULL,
  `sender` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `receiver` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `site_chat_messages`
--

INSERT INTO `site_chat_messages` (`id`, `sender`, `receiver`, `message`, `created_at`) VALUES
(1, 'Tim', 'SITE Officer', 'hsahdasd', '2025-12-03 23:57:57');

-- --------------------------------------------------------

--
-- Table structure for table `site_event`
--

CREATE TABLE `site_event` (
  `id` int NOT NULL,
  `event_title` varchar(255) NOT NULL,
  `event_description` text NOT NULL,
  `event_datetime` datetime DEFAULT NULL,
  `event_location` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `site_event`
--

INSERT INTO `site_event` (`id`, `event_title`, `event_description`, `event_datetime`, `event_location`, `created_at`) VALUES
(11, 'bft days', 'asfdf', '2025-12-02 22:19:00', '', '2025-12-02 14:19:49'),
(12, 's', 'ca', '2025-12-02 22:22:00', 'p2 mobod oroquita city', '2025-12-02 14:22:50'),
(13, '1wa', 'sasa', '2025-12-02 22:24:00', 'purok 2 western poblacion lopez jeana misamis occidental', '2025-12-02 14:25:07'),
(14, 'hashsgd', 'kasdknasd', '2025-12-03 08:00:00', 'lopez jaena', '2025-12-03 00:00:25'),
(15, 'sjjdsdf', 'dfssdf', '2025-12-08 08:58:00', 'purok 2 western poblacion lopez jeana misamis occidental', '2025-12-08 00:58:40'),
(16, 'it days', 'sadsad', '2025-12-08 09:13:00', 'p2 mobod oroquita city', '2025-12-08 01:13:41');

-- --------------------------------------------------------

--
-- Table structure for table `site_event_attendance`
--

CREATE TABLE `site_event_attendance` (
  `id` int NOT NULL,
  `event_id` int NOT NULL,
  `morning_in` varchar(20) DEFAULT NULL,
  `morning_out` varchar(20) DEFAULT NULL,
  `afternoon_in` varchar(20) DEFAULT NULL,
  `afternoon_out` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `site_event_attendance`
--

INSERT INTO `site_event_attendance` (`id`, `event_id`, `morning_in`, `morning_out`, `afternoon_in`, `afternoon_out`, `created_at`) VALUES
(1, 16, NULL, NULL, NULL, NULL, '2025-12-08 01:39:51');

-- --------------------------------------------------------

--
-- Table structure for table `site_reports`
--

CREATE TABLE `site_reports` (
  `id` int NOT NULL,
  `report_title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `report_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `officer_role` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'president',
  `attachment_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `site_reports`
--

INSERT INTO `site_reports` (`id`, `report_title`, `report_description`, `officer_role`, `attachment_path`, `created_at`) VALUES
(1, 'it days', 'days of all it sudent', 'president', 'assets/reports/rep_20251208_010549_f242a499.png', '2025-12-07 23:52:48');

-- --------------------------------------------------------

--
-- Table structure for table `site_service`
--

CREATE TABLE `site_service` (
  `id` int NOT NULL,
  `service_title` varchar(255) NOT NULL,
  `service_description` text NOT NULL,
  `service_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `site_service`
--

INSERT INTO `site_service` (`id`, `service_title`, `service_description`, `service_image`, `created_at`) VALUES
(1, 'qwe', 'wqewe', NULL, '2025-12-03 00:02:23'),
(2, 'qwe', 'wqewe', NULL, '2025-12-03 00:04:26'),
(3, '123d', 'sadd', NULL, '2025-12-03 00:04:42'),
(4, '123d', 'sadd', 'assets/img/services/svc_20251203_011230_a98c1f92.png', '2025-12-03 00:07:03'),
(5, 'windows intallation', 'freee', NULL, '2025-12-08 00:55:38');

-- --------------------------------------------------------

--
-- Table structure for table `student`
--

CREATE TABLE `student` (
  `id_number` int NOT NULL,
  `first_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `middle_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `course` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `year` int NOT NULL,
  `section` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `phone_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `role` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student`
--

INSERT INTO `student` (`id_number`, `first_name`, `middle_name`, `last_name`, `course`, `year`, `section`, `email`, `phone_number`, `role`) VALUES
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

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int UNSIGNED NOT NULL,
  `student_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'user',
  `department` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year_level` tinyint UNSIGNED DEFAULT NULL,
  `section` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `position` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `otp_code` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `terms_accepted_at` datetime DEFAULT NULL,
  `first_name` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `middle_name` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_name` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `student_id`, `password_hash`, `created_at`, `role`, `department`, `year_level`, `section`, `position`, `phone`, `email`, `otp_code`, `otp_expires_at`, `terms_accepted_at`, `first_name`, `middle_name`, `last_name`) VALUES
(1, '2023304631', '$2y$10$7jOMjNTboHGBd/lzNQpx6eNX46meVzHIm74prjY0sNCJ5xrSZ2D5S', '2025-10-27 10:57:30', 'student', 'BSIT', NULL, NULL, '', '09308288544', 'rpsvcodes@gmail.com', NULL, NULL, '2025-11-25 11:38:55', NULL, NULL, NULL),
(12, '2023304637', '$2y$10$ns7Q/W8P9nMCoX0rj9hUEOEJSRgrn3iJ8Vr0c07LFNTlXzuSNMKLm', '2025-11-23 04:40:11', 'admin', 'BSIT', 3, 'A', 'ElecomChairPerson', '09534181760', 'rpsvcodes@gmail.com', '', '2025-11-25 11:19:29', '2025-11-25 18:59:20', 'Redjan Phil', 'Seprado', 'Visitacion'),
(13, '2023304632', '$2y$10$x/hkWNcZ3soEiE2NayC5yeeT73inAfCW5OR8JmKCVDucZPbkXNFY6', '2025-01-31 16:00:00', 'student', 'BTLED', NULL, NULL, NULL, '09534181760', 'rpsvcodes@gmail.com', NULL, NULL, '2025-11-26 19:32:28', NULL, NULL, NULL),
(14, '2023304633', '$2y$10$q42WMlIagI/q0WC22FdGoeBXpjXqF/ZnAsxfzgyJqMp07BVWNSW3i', '2025-01-31 16:00:00', 'student', 'AFPROTECHS', NULL, NULL, NULL, '09534181760', 'rpsvcodes@gmail.com', NULL, NULL, '2025-11-26 19:34:29', NULL, NULL, NULL),
(15, '2022309359', '$2y$10$p5I5uRlPX0mif.I/DDzgsOCBIN8XIIMUGprCxJJm8kOXCWXI1J6YK', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09122135471', 'alexanderpepitojr6@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(16, '2022310650', '$2y$10$02MfjTsl3yBzLZd1WSOlg.qJcc.eXbBrp0SaPs.3ezb1zQtwfS.Xa', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09632986745', 'kurtcollinclintm@gmail.com', NULL, NULL, '2025-11-28 08:35:25', NULL, NULL, NULL),
(17, '2023304604', '$2y$10$Vw.yIHkSVu.TQvTmMmcV4usMIpq0VQppMr2j0I4Syqf99hv3.hDae', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09811284867', 'maerodriguez491@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(18, '2023304615', '$2y$10$BfGJHvHvvfNQO9TBZp9iDuAZ5gDXPvP2aCfk4TFRUEIdoae2gNLFa', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09817149863', 'lesterbulay18@gmail.com', '$2y$10$cMojS2gMsu2zQla/0shRBe0CVJFxNPyC0ilbFRzYok.tF9xqFKw5G', '2025-12-02 14:32:37', '2025-12-02 14:07:55', NULL, NULL, NULL),
(19, '2023304652', '$2y$10$SVNogaT4VwaBnSr4o7RUhunppeOpjLeLfmacFkMzJADvLLMjZWzY6', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09380324622', 'vincereyclaveria@gmail.com', NULL, NULL, '2025-11-27 21:56:35', NULL, NULL, NULL),
(20, '2023304665', '2023304665', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09097766612', 'rissaflorarnaiz70@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(21, '2023304673', '2023304673', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '0912962643', 'rodriguezalyssa3@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(22, '2023304700', '2023304700', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09079182482', 'lorietacan427@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(23, '2023304706', '$2y$10$r4g/uhoRk5/8YaNCvGiN.OXxQgflEtXFx0imR.JqExUTlVkntjCyq', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09302903570', 'arlynbaluoys33@gmail.com', NULL, NULL, '2025-11-27 22:06:05', NULL, NULL, NULL),
(24, '2023304707', '$2y$10$tdE26aApO3ZB2krMktDMSOf12Ex.x7YtPZBcLmW6GGmt8GlzhNtAK', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09510900990', 'jasonbaroro5@gmail.com', NULL, NULL, '2025-11-27 22:29:08', NULL, NULL, NULL),
(25, '2023304766', '2023304766', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09566726314', 'rullinjastinclaire@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(26, '2023304790', '$2y$10$Y0dgRrCyZlr0j4.lU3dDKepJRDZikmL63/Ne84PXva6nZjUBUmoZm', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09454256483', 'maicahpantua17@gmail.com', NULL, NULL, '2025-11-28 08:29:07', NULL, NULL, NULL),
(27, '2023304792', '2023304792', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09154589448', 'lenyviepauyon4@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(28, '2023304814', '2023304814', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09639231903', 'gellynrabino5@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(29, '2023304823', '$2y$10$JiQd2EJMfuYoGPI0CE1gJe9mM4Juhzi9q3lEUpZdvPwt6prlS7dP2', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09060735573', 'rizasalubodtual@gmail.com', NULL, NULL, '2025-12-11 09:36:37', NULL, NULL, NULL),
(30, '2023304832', '$2y$10$NIt1ar21IyWYU.qOmc9qTefF5aVo8WyO4N3p5mTpsYsl/5IwhWX1i', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09558451870', 'junjhey@gmail.com', NULL, NULL, '2025-12-12 00:56:54', NULL, NULL, NULL),
(31, '2023305014', '$2y$10$mfDvf48Yu1mG5VMVP.W9kOmqnCDeVI1G4k/.ss9BU7CT9VeqD5Aqq', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09663660466', 'kentcarreon19@gmail.com', NULL, NULL, '2025-11-27 22:44:43', NULL, NULL, NULL),
(32, '2023305025', '2023305025', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09516519480', 'johnyroldan86@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(33, '2023305026', '$2y$10$PWCSqrrLhQIQMPyaoYTSdeq94zo8.RyDuyrN6BKN7LfVTkjlOMuZe', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09509720680', 'roldankenneth47@gmail.com', NULL, NULL, '2025-11-27 21:57:09', NULL, NULL, NULL),
(34, '2023305178', '$2y$10$vKZMEdandePEPz0./xKfWe9LG8CS1ccUPvcAgynSE/XRgOeLTWqfu', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09451409487', 'markdavepanaguiton12345@gmail.com', NULL, NULL, '2025-12-03 16:21:51', NULL, NULL, NULL),
(35, '2023305220', '2023305220', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09634794894', 'gumatayaimejean@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(36, '2023305323', '$2y$10$LNAAnBVJZVL/86ujgsT2je1C4vHmhLlzwLbacyKTb6K.wr252/L7a', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09854623478', 'frisellagane62@gmail.com', NULL, NULL, '2025-11-27 23:58:40', NULL, NULL, NULL),
(37, '2023306312', '2023306312', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09816894516', 'sumoroymarkcyril@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(38, '2023306356', '$2y$10$02jga9l2fvrjAGA4C.oDM.CGxQ7zsr63AWg4Hjy.q/qrqEywtPDj2', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09286232954', 'kdumz23@gmail.com', NULL, NULL, '2025-11-27 21:58:00', NULL, NULL, NULL),
(39, '2023306358', '$2y$10$ISumYzWfCEwd7/Oz0Ak3cO57Q.8grn2ou6MuHpLV7VtlHeNI6NmUi', '2025-11-27 05:57:20', 'student', 'BSIT', 3, 'A', NULL, '09392750097', 'palaniajaymark85@gmail.com', NULL, NULL, '2025-11-28 07:25:52', NULL, NULL, NULL),
(40, '2023305122', '$2y$10$EAt7GqOI0gAXPfm.y2/Up.hHuSvVxTFeu/dMMDV2pD0PnnXrEdv6u', '2025-11-27 06:03:47', 'student', 'BSIT', NULL, NULL, NULL, '0912291136', 'jvbantiad@gmail.com', NULL, NULL, '2025-11-27 14:04:34', NULL, NULL, NULL),
(41, '2023304755', '$2y$10$5SXHOIQHdUckRdoiDFkfg..WJpuAw/C6DEfxAMAFve/q9ByoqgwFa', '2025-11-27 06:47:51', 'student', 'BSIT', NULL, NULL, NULL, '09464361784', 'queenyvonndalahahay@gmail.com', NULL, NULL, '2025-11-27 14:48:21', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_notifications`
--

CREATE TABLE `user_notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `student_id` varchar(64) NOT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'info',
  `title` varchar(255) NOT NULL,
  `body` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  `receipt_id` varchar(64) DEFAULT NULL,
  `pinned` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_notifications`
--

INSERT INTO `user_notifications` (`id`, `student_id`, `type`, `title`, `body`, `created_at`, `read_at`, `receipt_id`, `pinned`) VALUES
(176, '2023304631', 'success', 'Vote submitted', 'Your vote has been recorded. Receipt: R570cd7326330bb17', '2025-12-12 00:58:37', NULL, 'R570cd7326330bb17', 0);

-- --------------------------------------------------------

--
-- Table structure for table `usg_announcement`
--

CREATE TABLE `usg_announcement` (
  `announcement_id` int NOT NULL,
  `announcement_title` varchar(255) NOT NULL,
  `announcement_type` varchar(255) NOT NULL,
  `announcement_content` text NOT NULL,
  `announcement_datetime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--

CREATE TABLE `votes` (
  `id` int UNSIGNED NOT NULL,
  `student_id` varchar(64) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `votes`
--

INSERT INTO `votes` (`id`, `student_id`, `created_at`) VALUES
(144, '2023304631', '2025-12-12 00:58:36');

-- --------------------------------------------------------

--
-- Table structure for table `vote_items`
--

CREATE TABLE `vote_items` (
  `id` int UNSIGNED NOT NULL,
  `vote_id` int UNSIGNED NOT NULL,
  `position` varchar(128) NOT NULL,
  `candidate_id` int UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `vote_items`
--

INSERT INTO `vote_items` (`id`, `vote_id`, `position`, `candidate_id`, `created_at`) VALUES
(1025, 144, 'USG::President', 137, '2025-12-12 00:58:37'),
(1026, 144, 'USG::Vice President', 136, '2025-12-12 00:58:37'),
(1027, 144, 'USG::General Secretary', 111, '2025-12-12 00:58:37'),
(1028, 144, 'USG::Associate Secretary', 112, '2025-12-12 00:58:37'),
(1029, 144, 'USG::Treasurer', 113, '2025-12-12 00:58:37'),
(1030, 144, 'USG::Auditor', 114, '2025-12-12 00:58:37'),
(1031, 144, 'USG::Public Information Officer', 115, '2025-12-12 00:58:37'),
(1032, 144, 'USG::BSIT Representative', 101, '2025-12-12 00:58:37'),
(1033, 144, 'USG::BTLED Representative', 118, '2025-12-12 00:58:37'),
(1034, 144, 'USG::BFPT Representative', 120, '2025-12-12 00:58:37'),
(1035, 144, 'SITE::President', 102, '2025-12-12 00:58:37'),
(1036, 144, 'SITE::Vice President', 103, '2025-12-12 00:58:37'),
(1037, 144, 'SITE::General Secretary', 104, '2025-12-12 00:58:37'),
(1038, 144, 'SITE::Associate Secretary', 105, '2025-12-12 00:58:37'),
(1039, 144, 'SITE::Treasurer', 106, '2025-12-12 00:58:37'),
(1040, 144, 'SITE::Auditor', 107, '2025-12-12 00:58:37'),
(1041, 144, 'SITE::Public Information Officer', 108, '2025-12-12 00:58:37');

-- --------------------------------------------------------

--
-- Table structure for table `vote_receipts`
--

CREATE TABLE `vote_receipts` (
  `id` bigint UNSIGNED NOT NULL,
  `receipt_id` varchar(64) NOT NULL,
  `student_id` varchar(64) NOT NULL,
  `selections_json` json DEFAULT NULL,
  `selections_text` mediumtext,
  `total_selections` int UNSIGNED NOT NULL DEFAULT '0',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `vote_receipts`
--

INSERT INTO `vote_receipts` (`id`, `receipt_id`, `student_id`, `selections_json`, `selections_text`, `total_selections`, `ip_address`, `user_agent`, `created_at`) VALUES
(18, 'R6f20f4eb63257121', '2023304631', '{\"USG::President\": \"74\", \"SITE::President\": \"63\"}', '{\"USG::President\":\"74\",\"SITE::President\":\"63\"}', 2, '122.3.68.219', 'Dart/3.9 (dart:io)', '2025-12-02 04:11:52'),
(19, 'R144ced488ad6e6d5', '2023305026', '{\"USG::President\": \"61\", \"SITE::President\": \"65\"}', '{\"USG::President\":\"61\",\"SITE::President\":\"65\"}', 2, '122.3.68.219', 'Dart/3.9 (dart:io)', '2025-12-02 04:11:59'),
(20, 'R43c75d2828f47b7f', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"61\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"SITE::Associate Secretary\": \"79\"}', '{\"USG::President\":\"61\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 14, '122.3.68.219', 'Dart/3.9 (dart:io)', '2025-12-02 07:46:47'),
(21, 'R2541bd824e4fd303', '2023305014', '{\"USG::P.I.O\": \"72\", \"USG::Auditor\": \"71\", \"USG::President\": \"61\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"USG::Vice President\": \"67\", \"USG::General Secretary\": \"68\", \"USG::Associate Secretary\": \"69\"}', '{\"USG::President\":\"61\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"SITE::President\":\"65\"}', 8, '175.176.85.232', 'Dart/3.9 (dart:io)', '2025-12-02 07:58:10'),
(22, 'R2b0884deaa1c9d6e', '2023304615', '{\"USG::President\": \"61\"}', '{\"USG::President\":\"61\"}', 1, '49.149.103.31', 'Dart/3.9 (dart:io)', '2025-12-03 11:17:46'),
(23, 'Rb0553ff53cdcc446', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"61\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"98\", \"SITE::Associate Secretary\": \"79\"}', '{\"USG::President\":\"61\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"98\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 14, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-05 02:31:30'),
(24, 'R8e7bc943638d0171', '2022310650', '{\"USG::President\": \"61\", \"USG::Associate Secretary\": \"98\"}', '{\"USG::President\":\"61\",\"USG::Associate Secretary\":\"98\"}', 2, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 02:38:19'),
(25, 'Rbcd0423552a1f6b4', '2023304631', '{\"USG::President\": \"61\", \"SITE::President\": \"65\"}', '{\"USG::President\":\"61\",\"SITE::President\":\"65\"}', 2, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 04:45:30'),
(26, 'Rffcc41571249bf2b', '2023304631', '{\"USG::President\": \"61\"}', '{\"USG::President\":\"61\"}', 1, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 05:11:27'),
(27, 'R2ef8a6b2ababaa0e', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"61\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"SITE::Associate Secretary\": \"79\"}', '{\"USG::President\":\"61\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 14, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 05:21:55'),
(28, 'R47848009d03b07a6', '2023304632', '{\"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"PAFE::President\": \"83\"}', '{\"USG::President\":\"66\",\"USG::Treasurer\":\"70\",\"PAFE::President\":\"83\"}', 3, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 05:27:52'),
(29, 'Re0239e66a71a754e', '2023304633', '{\"USG::P.I.O\": \"72\", \"USG::Auditor\": \"71\", \"USG::President\": \"74\", \"USG::Treasurer\": \"70\", \"APFROTECHS::P.I.O\": \"96\", \"APFROTECHS::Auditor\": \"95\", \"USG::Vice President\": \"67\", \"APFROTECHS::President\": \"90\", \"APFROTECHS::Treasurer\": \"94\", \"USG::General Secretary\": \"68\", \"USG::Associate Secretary\": \"69\", \"APFROTECHS::Vice President\": \"91\", \"APFROTECHS::General Secretary\": \"92\", \"APFROTECHS::Associate Secretary\": \"93\"}', '{\"USG::President\":\"74\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"APFROTECHS::President\":\"90\",\"APFROTECHS::Vice President\":\"91\",\"APFROTECHS::General Secretary\":\"92\",\"APFROTECHS::Associate Secretary\":\"93\",\"APFROTECHS::Treasurer\":\"94\",\"APFROTECHS::Auditor\":\"95\",\"APFROTECHS::P.I.O\":\"96\"}', 14, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 05:36:06'),
(30, 'Ra658b9fcdda88542', '2023304631', '{\"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\"}', 1, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 08:26:07'),
(31, 'Rbdb573cb9e43a296', '2023304631', '{\"SITE::President\": \"76\", \"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\",\"SITE::President\":\"76\"}', 2, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-05 08:47:39'),
(32, 'Re8c25b49f9bab69b', '2023304631', '{\"USG::P.I.O\": \"72\", \"USG::Auditor\": \"71\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"USG::Vice President\": \"67\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::IT Representative\":\"61\",\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\"}', 10, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 08:59:17'),
(33, 'R62a0ebce4924775f', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-05 09:44:57'),
(34, 'R357dcb4e0a16d6bf', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-05 09:58:36'),
(35, 'Rd5a2311f80ec02eb', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 10:05:57'),
(36, 'Rea0ed0fce9aa840f', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-05 23:54:09'),
(37, 'R2757f5d307d3be66', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 00:15:13'),
(38, 'R520a5c5ab4f50ea3', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 00:20:22'),
(39, 'R304a0b5f5e5f60fb', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 00:26:02'),
(40, 'R1dc9dd387ade4f47', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 00:32:50'),
(41, 'R8818ddf9b7e08677', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 16, '175.176.85.182', 'Dart/3.9 (dart:io)', '2025-12-06 02:15:11'),
(42, 'R9e12af9c6ad0adbd', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"63\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"63\",\"SITE::General Secretary\":\"78\",\"SITE::Treasurer\":\"80\",\"SITE::Associate Secretary\":\"79\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 16, '175.176.85.182', 'Dart/3.9 (dart:io)', '2025-12-06 02:39:11'),
(43, 'R4b5183929b5a0128', '2023304631', '{\"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\"}', 1, '175.176.85.182', 'Dart/3.9 (dart:io)', '2025-12-06 02:56:36'),
(44, 'R4b8cacafc32a3657', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"63\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"63\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 04:43:38'),
(45, 'Rac9fe417098d5ade', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 04:44:46'),
(46, 'R6617c9657968aba0', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"73\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"73\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::P.I.O\":\"82\",\"SITE::Auditor\":\"81\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 04:45:38'),
(47, 'Rd9425bc5ce4ef9c3', '2023304632', '{\"USG::P.I.O\": \"72\", \"PAFE::P.I.O\": \"89\", \"USG::Auditor\": \"71\", \"PAFE::Auditor\": \"88\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"PAFE::President\": \"62\", \"PAFE::Treasurer\": \"87\", \"USG::Vice President\": \"67\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"PAFE::General Secretary\": \"85\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"PAFE::Associate Secretary\": \"86\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"PAFE::President\":\"62\",\"PAFE::General Secretary\":\"85\",\"PAFE::Associate Secretary\":\"86\",\"PAFE::Treasurer\":\"87\",\"PAFE::Auditor\":\"88\",\"PAFE::P.I.O\":\"89\"}', 16, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 04:58:27'),
(48, 'R700ffa47010069f5', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 05:59:15'),
(49, 'Rfe66d7e838006e2a', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 09:18:00'),
(50, 'R15b3eb92d07bf14e', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 09:46:23'),
(51, 'R95985429ac8ccd8a', '2023304631', '{\"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\"}', 1, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 12:08:15'),
(52, 'R6947e7d1cf138b95', '2023304631', '{\"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\"}', 1, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 12:12:26'),
(53, 'R352130a6c2c077e4', '2023304631', '{\"USG::Vice President\": \"67\"}', '{\"USG::Vice President\":\"67\"}', 1, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 12:25:50'),
(54, 'Rc2056cd9602c7022', '2023304631', '{\"USG::Treasurer\": \"70\", \"USG::Associate Secretary\": \"69\"}', '{\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\"}', 2, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 12:42:54'),
(55, 'R4123cdac323f2b6f', '2023304631', '{\"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\"}', 1, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 12:47:38'),
(56, 'R4503531bb67c89b4', '2023304631', '{\"USG::IT Representative\": \"61\"}', '{\"USG::IT Representative\":\"61\"}', 1, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 12:49:49'),
(57, 'Rc7b7f2dc090490ad', '2023304631', '{\"USG::Treasurer\": \"70\"}', '{\"USG::Treasurer\":\"70\"}', 1, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 12:51:08'),
(58, 'R6fd5b46a39c07b1c', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::Vice President\":\"67\",\"USG::President\":\"66\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '61.245.14.254', 'Dart/3.9 (dart:io)', '2025-12-06 12:52:16'),
(59, 'R7c69592306b9782b', '2023304631', '{\"USG::General Secretary\": \"68\"}', '{\"USG::General Secretary\":\"68\"}', 1, '203.177.22.250', 'Dart/3.9 (dart:io)', '2025-12-06 13:18:14'),
(60, 'Rb1b3e5b3bdfbe715', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"76\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"76\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 16, '175.176.84.126', 'Dart/3.9 (dart:io)', '2025-12-06 14:38:32'),
(61, 'R8c577fb2177646c1', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '175.176.84.4', 'Dart/3.9 (dart:io)', '2025-12-07 00:32:30'),
(62, 'R7a46bfd247b305f5', '2023304631', '{\"USG::P.I.O\": \"72\", \"SITE::P.I.O\": \"82\", \"USG::Auditor\": \"71\", \"SITE::Auditor\": \"81\", \"USG::President\": \"66\", \"USG::Treasurer\": \"70\", \"SITE::President\": \"65\", \"SITE::Treasurer\": \"80\", \"USG::Vice President\": \"67\", \"SITE::Vice President\": \"77\", \"USG::General Secretary\": \"68\", \"USG::IT Representative\": \"61\", \"SITE::General Secretary\": \"78\", \"USG::Associate Secretary\": \"69\", \"USG::BFPT Representative\": \"75\", \"SITE::Associate Secretary\": \"79\", \"USG::BTLED Representative\": \"74\"}', '{\"USG::President\":\"66\",\"USG::Vice President\":\"67\",\"USG::General Secretary\":\"68\",\"USG::Associate Secretary\":\"69\",\"USG::Treasurer\":\"70\",\"USG::Auditor\":\"71\",\"USG::P.I.O\":\"72\",\"USG::IT Representative\":\"61\",\"USG::BTLED Representative\":\"74\",\"USG::BFPT Representative\":\"75\",\"SITE::President\":\"65\",\"SITE::Vice President\":\"77\",\"SITE::General Secretary\":\"78\",\"SITE::Associate Secretary\":\"79\",\"SITE::Treasurer\":\"80\",\"SITE::Auditor\":\"81\",\"SITE::P.I.O\":\"82\"}', 17, '175.176.84.4', 'Dart/3.9 (dart:io)', '2025-12-07 00:33:19'),
(63, 'R2db33de8a55542f0', '2023304631', '{\"USG::IT Representative\": \"101\"}', '{\"USG::IT Representative\":\"101\"}', 1, '175.176.85.102', 'Dart/3.9 (dart:io)', '2025-12-08 04:56:19'),
(64, 'R9a18ff2b027e7d5c', '2023304615', '{\"USG::President\": \"101\"}', '{\"USG::President\":\"101\"}', 1, '49.149.101.127', 'Dart/3.9 (dart:io)', '2025-12-08 06:56:02'),
(65, 'R8c7bef75beacd02a', '2023304631', '{\"USG::IT Representative\": \"101\"}', '{\"USG::IT Representative\":\"101\"}', 1, '175.176.85.102', 'Dart/3.9 (dart:io)', '2025-12-08 12:08:08'),
(66, 'R5515c868f7d8cad4', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"109\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"110\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"120\", \"USG::BSIT Representative\": \"116\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"118\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"109\",\"USG::Vice President\":\"110\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"116\",\"USG::BTLED Representative\":\"118\",\"USG::BFPT Representative\":\"120\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '175.176.85.102', 'Dart/3.9 (dart:io)', '2025-12-10 12:38:41'),
(67, 'R8560ffe0a46b42a4', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"109\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"110\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"120\", \"USG::BSIT Representative\": \"116\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"118\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"109\",\"USG::Vice President\":\"110\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"116\",\"USG::BTLED Representative\":\"118\",\"USG::BFPT Representative\":\"120\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '175.176.85.102', 'Dart/3.9 (dart:io)', '2025-12-10 12:46:04'),
(68, 'R8d6df38255d99e27', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"109\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"110\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"119\", \"USG::BSIT Representative\": \"116\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"117\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"109\",\"USG::Vice President\":\"110\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"116\",\"USG::BTLED Representative\":\"117\",\"USG::BFPT Representative\":\"119\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '175.176.85.102', 'Dart/3.9 (dart:io)', '2025-12-10 13:02:17'),
(69, 'Rf3eef1f3d96ba453', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"109\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"136\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"120\", \"USG::BSIT Representative\": \"101\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"118\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"109\",\"USG::Vice President\":\"136\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"101\",\"USG::BTLED Representative\":\"118\",\"USG::BFPT Representative\":\"120\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '131.226.114.41', 'Dart/3.9 (dart:io)', '2025-12-10 15:02:58'),
(70, 'R386a9614cc51eb9e', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"109\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"136\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"120\", \"USG::BSIT Representative\": \"116\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"118\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"109\",\"USG::Vice President\":\"136\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"116\",\"USG::BTLED Representative\":\"118\",\"USG::BFPT Representative\":\"120\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '110.54.201.189', 'Dart/3.9 (dart:io)', '2025-12-11 05:24:46'),
(71, 'Rda108d77cff4f90e', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"109\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"136\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"120\", \"USG::BSIT Representative\": \"116\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"118\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"109\",\"USG::Vice President\":\"136\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"116\",\"USG::BTLED Representative\":\"118\",\"USG::BFPT Representative\":\"120\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '110.54.203.1', 'Dart/3.9 (dart:io)', '2025-12-11 09:24:28'),
(72, 'R570cd7326330bb17', '2023304631', '{\"USG::Auditor\": \"114\", \"SITE::Auditor\": \"107\", \"USG::President\": \"137\", \"USG::Treasurer\": \"113\", \"SITE::President\": \"102\", \"SITE::Treasurer\": \"106\", \"USG::Vice President\": \"136\", \"SITE::Vice President\": \"103\", \"USG::General Secretary\": \"111\", \"SITE::General Secretary\": \"104\", \"USG::Associate Secretary\": \"112\", \"USG::BFPT Representative\": \"120\", \"USG::BSIT Representative\": \"101\", \"SITE::Associate Secretary\": \"105\", \"USG::BTLED Representative\": \"118\", \"USG::Public Information Officer\": \"115\", \"SITE::Public Information Officer\": \"108\"}', '{\"USG::President\":\"137\",\"USG::Vice President\":\"136\",\"USG::General Secretary\":\"111\",\"USG::Associate Secretary\":\"112\",\"USG::Treasurer\":\"113\",\"USG::Auditor\":\"114\",\"USG::Public Information Officer\":\"115\",\"USG::BSIT Representative\":\"101\",\"USG::BTLED Representative\":\"118\",\"USG::BFPT Representative\":\"120\",\"SITE::President\":\"102\",\"SITE::Vice President\":\"103\",\"SITE::General Secretary\":\"104\",\"SITE::Associate Secretary\":\"105\",\"SITE::Treasurer\":\"106\",\"SITE::Auditor\":\"107\",\"SITE::Public Information Officer\":\"108\"}', 17, '122.3.68.219', 'Dart/3.9 (dart:io)', '2025-12-12 00:58:37');

-- --------------------------------------------------------

--
-- Table structure for table `vote_results`
--

CREATE TABLE `vote_results` (
  `candidate_id` int UNSIGNED NOT NULL,
  `position` varchar(128) NOT NULL,
  `votes` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `vote_results`
--

INSERT INTO `vote_results` (`candidate_id`, `position`, `votes`) VALUES
(101, 'USG::BSIT Representative', 1),
(102, 'SITE::President', 1),
(103, 'SITE::Vice President', 1),
(104, 'SITE::General Secretary', 1),
(105, 'SITE::Associate Secretary', 1),
(106, 'SITE::Treasurer', 1),
(107, 'SITE::Auditor', 1),
(108, 'SITE::Public Information Officer', 1),
(111, 'USG::General Secretary', 1),
(112, 'USG::Associate Secretary', 1),
(113, 'USG::Treasurer', 1),
(114, 'USG::Auditor', 1),
(115, 'USG::Public Information Officer', 1),
(118, 'USG::BTLED Representative', 1),
(120, 'USG::BFPT Representative', 1),
(136, 'USG::Vice President', 1),
(137, 'USG::President', 1);

-- --------------------------------------------------------

--
-- Table structure for table `vote_windows`
--

CREATE TABLE `vote_windows` (
  `id` int UNSIGNED NOT NULL,
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `results_at` datetime DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `vote_windows`
--

INSERT INTO `vote_windows` (`id`, `start_at`, `end_at`, `results_at`, `note`, `created_at`, `updated_at`) VALUES
(11, '2025-12-01 06:00:00', '2026-01-01 21:00:00', '2026-01-01 21:00:00', 'Vote wisely', '2025-12-01 14:27:02', '2025-12-08 05:23:00');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `access_announcement`
--
ALTER TABLE `access_announcement`
  ADD PRIMARY KEY (`announcement_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `access_feedback`
--
ALTER TABLE `access_feedback`
  ADD PRIMARY KEY (`feedback_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `access_gallery`
--
ALTER TABLE `access_gallery`
  ADD PRIMARY KEY (`gallery_id`),
  ADD KEY `uploaded_by` (`uploaded_by`);

--
-- Indexes for table `access_learning_resource`
--
ALTER TABLE `access_learning_resource`
  ADD PRIMARY KEY (`resource_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `access_service_request`
--
ALTER TABLE `access_service_request`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `requested_by` (`requested_by`),
  ADD KEY `assigned_to` (`assigned_to`);

--
-- Indexes for table `afprotechs_announcements`
--
ALTER TABLE `afprotechs_announcements`
  ADD PRIMARY KEY (`announcement_id`);

--
-- Indexes for table `afprotechs_countdown`
--
ALTER TABLE `afprotechs_countdown`
  ADD PRIMARY KEY (`countdown_id`);

--
-- Indexes for table `afprotechs_events`
--
ALTER TABLE `afprotechs_events`
  ADD PRIMARY KEY (`event_id`);

--
-- Indexes for table `arts_announcements`
--
ALTER TABLE `arts_announcements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `arts_clubs`
--
ALTER TABLE `arts_clubs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `arts_club_applications`
--
ALTER TABLE `arts_club_applications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_club_id` (`club_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `arts_events`
--
ALTER TABLE `arts_events`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `arts_feedback`
--
ALTER TABLE `arts_feedback`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `arts_messages`
--
ALTER TABLE `arts_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_event` (`student_id`,`event_id`),
  ADD KEY `idx_organization` (`organization`),
  ADD KEY `idx_attendance_date` (`attendance_date`);

--
-- Indexes for table `candidates_registration`
--
ALTER TABLE `candidates_registration`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_student_org_position` (`student_id`,`organization`,`position`);

--
-- Indexes for table `chat_auto_responses`
--
ALTER TABLE `chat_auto_responses`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `chat_message_analysis`
--
ALTER TABLE `chat_message_analysis`
  ADD PRIMARY KEY (`id`),
  ADD KEY `message_id` (`message_id`);

--
-- Indexes for table `chat_notifications`
--
ALTER TABLE `chat_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `chat_statistics`
--
ALTER TABLE `chat_statistics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_student` (`student_id`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pafe_announcements`
--
ALTER TABLE `pafe_announcements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pafe_events`
--
ALTER TABLE `pafe_events`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pafe_event_attendance`
--
ALTER TABLE `pafe_event_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_attendance` (`event_id`,`student_id`,`session_type`);

--
-- Indexes for table `pafe_feedback`
--
ALTER TABLE `pafe_feedback`
  ADD PRIMARY KEY (`id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `redcross_activities`
--
ALTER TABLE `redcross_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `member_idx` (`member_id`);

--
-- Indexes for table `redcross_announcements`
--
ALTER TABLE `redcross_announcements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `redcross_campaigns`
--
ALTER TABLE `redcross_campaigns`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `redcross_certificates`
--
ALTER TABLE `redcross_certificates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cert_member_idx` (`member_id`);

--
-- Indexes for table `redcross_members`
--
ALTER TABLE `redcross_members`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `redcross_patients`
--
ALTER TABLE `redcross_patients`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `site_attendance`
--
ALTER TABLE `site_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_student_date` (`student_id`,`attendance_date`),
  ADD KEY `fk_event_id` (`event_id`);

--
-- Indexes for table `site_chat`
--
ALTER TABLE `site_chat`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_timestamp` (`student_id`,`timestamp`);

--
-- Indexes for table `site_chat_messages`
--
ALTER TABLE `site_chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sender_receiver_created` (`sender`,`receiver`,`created_at`),
  ADD KEY `idx_receiver_sender_created` (`receiver`,`sender`,`created_at`);

--
-- Indexes for table `site_event`
--
ALTER TABLE `site_event`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `site_event_attendance`
--
ALTER TABLE `site_event_attendance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`);

--
-- Indexes for table `site_reports`
--
ALTER TABLE `site_reports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `site_service`
--
ALTER TABLE `site_service`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `student`
--
ALTER TABLE `student`
  ADD PRIMARY KEY (`id_number`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `student_id` (`student_id`),
  ADD UNIQUE KEY `idx_users_student_id` (`student_id`);

--
-- Indexes for table `user_notifications`
--
ALTER TABLE `user_notifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_student_receipt` (`student_id`,`receipt_id`),
  ADD KEY `idx_student_created` (`student_id`,`created_at`);

--
-- Indexes for table `usg_announcement`
--
ALTER TABLE `usg_announcement`
  ADD PRIMARY KEY (`announcement_id`);

--
-- Indexes for table `votes`
--
ALTER TABLE `votes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `student_id` (`student_id`);

--
-- Indexes for table `vote_items`
--
ALTER TABLE `vote_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_vote_position` (`vote_id`,`position`);

--
-- Indexes for table `vote_receipts`
--
ALTER TABLE `vote_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_receipt_id` (`receipt_id`),
  ADD KEY `ix_student_created` (`student_id`,`created_at`),
  ADD KEY `ix_created` (`created_at`);

--
-- Indexes for table `vote_results`
--
ALTER TABLE `vote_results`
  ADD PRIMARY KEY (`candidate_id`),
  ADD KEY `idx_position` (`position`);

--
-- Indexes for table `vote_windows`
--
ALTER TABLE `vote_windows`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `access_announcement`
--
ALTER TABLE `access_announcement`
  MODIFY `announcement_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `access_feedback`
--
ALTER TABLE `access_feedback`
  MODIFY `feedback_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `access_gallery`
--
ALTER TABLE `access_gallery`
  MODIFY `gallery_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `access_learning_resource`
--
ALTER TABLE `access_learning_resource`
  MODIFY `resource_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `access_service_request`
--
ALTER TABLE `access_service_request`
  MODIFY `request_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `afprotechs_announcements`
--
ALTER TABLE `afprotechs_announcements`
  MODIFY `announcement_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `afprotechs_countdown`
--
ALTER TABLE `afprotechs_countdown`
  MODIFY `countdown_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `afprotechs_events`
--
ALTER TABLE `afprotechs_events`
  MODIFY `event_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `arts_announcements`
--
ALTER TABLE `arts_announcements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `arts_clubs`
--
ALTER TABLE `arts_clubs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `arts_club_applications`
--
ALTER TABLE `arts_club_applications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `arts_events`
--
ALTER TABLE `arts_events`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `arts_feedback`
--
ALTER TABLE `arts_feedback`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `arts_messages`
--
ALTER TABLE `arts_messages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `candidates_registration`
--
ALTER TABLE `candidates_registration`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=138;

--
-- AUTO_INCREMENT for table `chat_auto_responses`
--
ALTER TABLE `chat_auto_responses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `chat_message_analysis`
--
ALTER TABLE `chat_message_analysis`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `chat_notifications`
--
ALTER TABLE `chat_notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `chat_statistics`
--
ALTER TABLE `chat_statistics`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `pafe_announcements`
--
ALTER TABLE `pafe_announcements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `pafe_events`
--
ALTER TABLE `pafe_events`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `pafe_event_attendance`
--
ALTER TABLE `pafe_event_attendance`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pafe_feedback`
--
ALTER TABLE `pafe_feedback`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `redcross_activities`
--
ALTER TABLE `redcross_activities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `redcross_announcements`
--
ALTER TABLE `redcross_announcements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `redcross_campaigns`
--
ALTER TABLE `redcross_campaigns`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `redcross_certificates`
--
ALTER TABLE `redcross_certificates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `redcross_members`
--
ALTER TABLE `redcross_members`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `redcross_patients`
--
ALTER TABLE `redcross_patients`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `site_attendance`
--
ALTER TABLE `site_attendance`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_chat`
--
ALTER TABLE `site_chat`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `site_chat_messages`
--
ALTER TABLE `site_chat_messages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `site_event`
--
ALTER TABLE `site_event`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `site_event_attendance`
--
ALTER TABLE `site_event_attendance`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `site_reports`
--
ALTER TABLE `site_reports`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `site_service`
--
ALTER TABLE `site_service`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `user_notifications`
--
ALTER TABLE `user_notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=177;

--
-- AUTO_INCREMENT for table `usg_announcement`
--
ALTER TABLE `usg_announcement`
  MODIFY `announcement_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `votes`
--
ALTER TABLE `votes`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=145;

--
-- AUTO_INCREMENT for table `vote_items`
--
ALTER TABLE `vote_items`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1042;

--
-- AUTO_INCREMENT for table `vote_receipts`
--
ALTER TABLE `vote_receipts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `vote_windows`
--
ALTER TABLE `vote_windows`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `access_announcement`
--
ALTER TABLE `access_announcement`
  ADD CONSTRAINT `access_announcement_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `student` (`id_number`) ON DELETE SET NULL;

--
-- Constraints for table `access_feedback`
--
ALTER TABLE `access_feedback`
  ADD CONSTRAINT `access_feedback_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `student` (`id_number`) ON DELETE CASCADE;

--
-- Constraints for table `access_gallery`
--
ALTER TABLE `access_gallery`
  ADD CONSTRAINT `access_gallery_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `student` (`id_number`) ON DELETE SET NULL;

--
-- Constraints for table `access_learning_resource`
--
ALTER TABLE `access_learning_resource`
  ADD CONSTRAINT `access_learning_resource_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `student` (`id_number`) ON DELETE SET NULL;

--
-- Constraints for table `access_service_request`
--
ALTER TABLE `access_service_request`
  ADD CONSTRAINT `access_service_request_ibfk_1` FOREIGN KEY (`requested_by`) REFERENCES `student` (`id_number`) ON DELETE SET NULL,
  ADD CONSTRAINT `access_service_request_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `student` (`id_number`) ON DELETE SET NULL;

--
-- Constraints for table `chat_message_analysis`
--
ALTER TABLE `chat_message_analysis`
  ADD CONSTRAINT `chat_message_analysis_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `site_chat` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `chat_notifications`
--
ALTER TABLE `chat_notifications`
  ADD CONSTRAINT `chat_notifications_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `student` (`id_number`) ON DELETE CASCADE;

--
-- Constraints for table `chat_statistics`
--
ALTER TABLE `chat_statistics`
  ADD CONSTRAINT `chat_statistics_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `student` (`id_number`) ON DELETE CASCADE;

--
-- Constraints for table `pafe_event_attendance`
--
ALTER TABLE `pafe_event_attendance`
  ADD CONSTRAINT `pafe_event_attendance_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `pafe_events` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `pafe_feedback`
--
ALTER TABLE `pafe_feedback`
  ADD CONSTRAINT `pafe_feedback_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `student` (`id_number`) ON DELETE SET NULL;

--
-- Constraints for table `redcross_activities`
--
ALTER TABLE `redcross_activities`
  ADD CONSTRAINT `fk_redcross_activities_member` FOREIGN KEY (`member_id`) REFERENCES `redcross_members` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `redcross_certificates`
--
ALTER TABLE `redcross_certificates`
  ADD CONSTRAINT `fk_redcross_cert_member` FOREIGN KEY (`member_id`) REFERENCES `redcross_members` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `site_attendance`
--
ALTER TABLE `site_attendance`
  ADD CONSTRAINT `fk_event_id` FOREIGN KEY (`event_id`) REFERENCES `site_event` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `site_chat`
--
ALTER TABLE `site_chat`
  ADD CONSTRAINT `site_chat_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `student` (`id_number`) ON DELETE CASCADE;

--
-- Constraints for table `site_event_attendance`
--
ALTER TABLE `site_event_attendance`
  ADD CONSTRAINT `site_event_attendance_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `site_event` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `vote_items`
--
ALTER TABLE `vote_items`
  ADD CONSTRAINT `fk_vote_items_vote` FOREIGN KEY (`vote_id`) REFERENCES `votes` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
