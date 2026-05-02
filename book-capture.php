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
    sanitize_log_field($email),
    sanitize_log_field($name),
    sanitize_log_field($context)
);

file_put_contents(__DIR__ . '/book-capture.log', $line, FILE_APPEND | LOCK_EX);

header('Location: /book/thanks/');
exit;
