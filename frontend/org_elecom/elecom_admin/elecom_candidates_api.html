<?php
require_once '../../../db_connection.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }
header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : 'search';

function ensure_admin() {
    $role = isset($_SESSION['role']) ? strtolower((string)$_SESSION['role']) : '';
    if ($role !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
}

try {
    if ($action === 'list') {
        $q = isset($_GET['q']) ? trim($_GET['q']) : '';
        $where = '';
        $params = [];
        if ($q !== '') {
            $where = "WHERE CONCAT(first_name,' ',middle_name,' ',last_name) LIKE :q
                      OR student_id LIKE :q OR position LIKE :q OR organization LIKE :q OR party_name LIKE :q";
            $params[':q'] = "%{$q}%";
        }
        $sql = "SELECT id, student_id, first_name, middle_name, last_name, position, organization, program, year_section, photo_url, party_name, candidate_type, party_logo_url
                FROM candidates_registration $where
                ORDER BY party_name, organization, position, last_name, first_name
                LIMIT 100";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
        exit;
    }
    if ($action === 'search') {
        $q = isset($_GET['q']) ? trim($_GET['q']) : '';
        if ($q === '') {
            echo json_encode([]);
            exit;
        }
        $like = "%{$q}%";
        $stmt = $pdo->prepare(
            "SELECT id, student_id, first_name, middle_name, last_name, position, organization, photo_url, party_name
             FROM candidates_registration
             WHERE CONCAT(first_name,' ',middle_name,' ',last_name) LIKE :q
                OR student_id LIKE :q
                OR position LIKE :q
                OR organization LIKE :q
                OR party_name LIKE :q
             ORDER BY last_name, first_name
             LIMIT 10"
        );
        $stmt->execute([':q' => $like]);
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
        exit;
    }

    if ($action === 'detail') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid id']);
            exit;
        }
        $stmt = $pdo->prepare("SELECT * FROM candidates_registration WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        echo json_encode($row);
        exit;
    }

    if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        ensure_admin();
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['error'=>'Invalid id']); exit; }
        $fields = [
            'first_name','middle_name','last_name','organization','position',
            'program','year_section','platform','candidate_type','party_name',
            'photo_url','party_logo_url'
        ];
        $sets = [];$params=[':id'=>$id];
        foreach ($fields as $f) {
            if (isset($_POST[$f])) { $sets[] = "$f = :$f"; $params[":$f"] = trim((string)$_POST[$f]); }
        }
        if (empty($sets)) { echo json_encode(['ok'=>true]); exit; }
        // Rule: Representative positions only for USG
        if (isset($_POST['position']) && stripos((string)$_POST['position'],'Representative') !== false) {
            if (!isset($_POST['organization']) || strtoupper((string)$_POST['organization']) !== 'USG') {
                http_response_code(400); echo json_encode(['error'=>'Representative only allowed for USG']); exit;
            }
        }
        $sql = 'UPDATE candidates_registration SET '.implode(',',$sets).' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['ok'=>true]);
        exit;
    }

    if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        ensure_admin();
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['error'=>'Invalid id']); exit; }
        $stmt = $pdo->prepare('DELETE FROM candidates_registration WHERE id = :id');
        $stmt->execute([':id'=>$id]);
        echo json_encode(['ok'=>true]);
        exit;
    }

    if ($action === 'bulk_delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        ensure_admin();
        $raw = $_POST['ids'] ?? '';
        if ($raw === '') { http_response_code(400); echo json_encode(['error'=>'No ids provided']); exit; }
        $ids = [];
        if (is_array($raw)) { $ids = array_map('intval', $raw); }
        else {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) { $ids = array_map('intval', $decoded); }
            else { $ids = array_map('intval', explode(',', (string)$raw)); }
        }
        $ids = array_values(array_filter($ids, fn($v)=> $v>0));
        if (empty($ids)) { http_response_code(400); echo json_encode(['error'=>'No valid ids']); exit; }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("DELETE FROM candidates_registration WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        echo json_encode(['ok'=>true, 'deleted'=>count($ids)]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
