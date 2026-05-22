-- =============================================
-- FindIt — Lost & Found Database Schema
-- Run this in MySQL before starting the server
-- =============================================

CREATE DATABASE IF NOT EXISTS findit_db;
USE findit_db;

-- ── Users Table ──
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT '',
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Items Table ──
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('lost', 'found') NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  date_reported DATE NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  contact VARCHAR(255) DEFAULT '',
  status ENUM('lost', 'found', 'claimed') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Claims Table ──
CREATE TABLE IF NOT EXISTS claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  claimant_name VARCHAR(255) NOT NULL,
  proof TEXT NOT NULL,
  contact VARCHAR(255) DEFAULT '',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ══════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════

-- Admin account: admin@findit.com / admin123
-- Password hash generated with bcryptjs (10 rounds)
INSERT INTO users (first_name, last_name, email, password, phone, role) VALUES
  ('Admin', 'FindIt', 'admin@findit.com', '$2a$10$8K1p/IOxCOl4.PYRsh8wVOqGFQVnNVGGcrBKYMxzIiPx3YSFhqTpS', '09170000000', 'admin'),
  ('Johnpaul', 'Reyes', 'johnpaul.reyes@email.com', '$2a$10$8K1p/IOxCOl4.PYRsh8wVOqGFQVnNVGGcrBKYMxzIiPx3YSFhqTpS', '09171234567', 'user'),
  ('Lloyd', 'Santos', 'lloyd@mail.com', '$2a$10$8K1p/IOxCOl4.PYRsh8wVOqGFQVnNVGGcrBKYMxzIiPx3YSFhqTpS', '09181111111', 'user'),
  ('Noknok', 'Cruz', 'noknok@mail.com', '$2a$10$8K1p/IOxCOl4.PYRsh8wVOqGFQVnNVGGcrBKYMxzIiPx3YSFhqTpS', '09182222222', 'user'),
  ('Alleish', 'Garcia', 'alleish@email.com', '$2a$10$8K1p/IOxCOl4.PYRsh8wVOqGFQVnNVGGcrBKYMxzIiPx3YSFhqTpS', '09183333333', 'user');

-- Seed items (user_id references the users above)
INSERT INTO items (user_id, name, type, category, date_reported, location, description, contact, status) VALUES
  (2, 'Black iPhone 14', 'lost', 'Electronics', '2024-11-15', 'SM Megamall, 3F', 'Black iPhone 14 with cracked screen protector. Has a blue phone case.', '09171234567', 'lost'),
  (3, 'Red Umbrella', 'found', 'Other', '2024-11-18', 'LRT Cubao Station', 'Large red folding umbrella. Found near the turnstiles.', 'lloyd@mail.com', 'found'),
  (4, 'Student ID Card', 'found', 'Documents', '2024-11-17', 'Araneta City', 'DLSU student ID for a certain Maria Santos. Laminated.', '09181234567', 'found'),
  (5, 'Airpods Pro Case', 'lost', 'Electronics', '2024-11-14', 'Jollibee, EDSA', 'White Airpods Pro charging case, no earbuds inside. Engraved with initials.', 'alleish@email.com', 'lost'),
  (2, 'Brown Leather Wallet', 'lost', 'Accessories', '2024-11-16', 'MRT North Ave Station', 'Tan leather bifold wallet. Had cards and some cash.', '09171234567', 'claimed'),
  (5, 'Mini Poodle', 'lost', 'Pets', '2024-11-13', 'Quezon Memorial Circle', 'White mini poodle named Coco, wearing a pink collar with a bell.', 'alleish@email.com', 'lost');

-- Seed claims
INSERT INTO claims (item_id, user_id, claimant_name, proof, contact, status) VALUES
  (4, 3, 'Maria Santos', 'It has my initials MA engraved on the bottom right corner of the lid', '09209876543', 'pending'),
  (5, 2, 'Jose Reyes', 'Wallet has a photo of my dog and a library card from Quezon City library', '09178765432', 'approved'),
  (1, 4, 'Anna Cruz', 'Screen lock pattern is a star shape, wallpaper is a beach sunset photo', '09151234567', 'pending');
