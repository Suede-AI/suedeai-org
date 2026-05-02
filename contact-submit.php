<?php
declare(strict_types=1);

const MAX_FIELD_LENGTH = 512;

function sanitize_log_field(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    $clean = preg_replace('/\s+/', ' ', $trimmed);
    $clean = preg_replace('/[^\x20-\x7E]/', '', $clean);
    return substr($clean, 0, MAX_FIELD_LENGTH);
}

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
    sanitize_log_field($name),
    sanitize_log_field($email),
    sanitize_log_field($topic),
    sanitize_log_field($message)
);

file_put_contents(__DIR__ . '/contact-submit.log', $line, FILE_APPEND | LOCK_EX);

header('Location: /contact/thanks/');
exit;
