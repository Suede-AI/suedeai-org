<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /book/');
    exit;
}

$email = trim((string) ($_POST['email'] ?? ''));
$name = trim((string) ($_POST['name'] ?? ''));
$context = trim((string) ($_POST['context'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: /book/?error=invalid-email');
    exit;
}

$line = sprintf(
    "[%s]\t%s\t%s\t%s\n",
    date('c'),
    $email,
    $name,
    preg_replace('/\s+/', ' ', $context)
);

file_put_contents(__DIR__ . '/book-capture.log', $line, FILE_APPEND | LOCK_EX);

header('Location: /book/thanks/');
exit;
