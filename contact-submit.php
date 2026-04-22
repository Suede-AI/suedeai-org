<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /contact/');
    exit;
}

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$topic = trim((string) ($_POST['topic'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || $message === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header('Location: /contact/?error=invalid-form');
    exit;
}

$line = sprintf(
    "[%s]\t%s\t%s\t%s\t%s\n",
    date('c'),
    $name,
    $email,
    $topic,
    preg_replace('/\s+/', ' ', $message)
);

file_put_contents(__DIR__ . '/contact-submit.log', $line, FILE_APPEND | LOCK_EX);

header('Location: /contact/thanks/');
exit;
