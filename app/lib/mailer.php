<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  ENVIO DE CORREO
 *  Modos: 'mail' (funcion mail()), 'smtp' (servidor SMTP) y 'log' (pruebas).
 *  El modo SMTP habla el protocolo directamente por socket, sin dependencias.
 * ============================================================================
 */

/** Envia un correo. Devuelve true si se entrego/encolo correctamente. */
function send_mail(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
{
    $cfg       = config('mail');
    $fromEmail = $cfg['from_email'] ?? 'no-reply@localhost';
    $fromName  = $cfg['from_name'] ?? '';
    $transport = $cfg['transport'] ?? 'log';

    if ($textBody === '') {
        $textBody = trim(html_entity_decode(strip_tags($htmlBody), ENT_QUOTES, 'UTF-8'));
    }

    if ($transport === 'log') {
        $line = sprintf(
            "[%s] TO:%s | FROM:%s | SUBJECT:%s\n%s\n%s\n",
            date('Y-m-d H:i:s'),
            $to,
            $fromEmail,
            $subject,
            str_repeat('-', 40),
            $textBody
        );
        @file_put_contents(log_dir() . '/mail.log', $line, FILE_APPEND | LOCK_EX);
        return true;
    }

    if ($transport === 'smtp') {
        return smtp_send($to, $subject, $htmlBody, $textBody, $cfg);
    }

    // Modo 'mail' nativo
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . mailer_format_address($fromEmail, $fromName),
        'Reply-To: ' . $fromEmail,
        'X-Mailer: C-ROTULUS',
    ];
    $ok = @mail($to, mailer_encode_subject($subject), $htmlBody, implode("\r\n", $headers));
    if (!$ok) {
        app_log("mail() fallo al enviar a $to");
    }
    return $ok;
}

/** Codifica el asunto con acentos correctamente. */
function mailer_encode_subject(string $subject): string
{
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

/** Plantilla HTML basica para los correos transaccionales. */
function mailer_template(string $title, string $content): string
{
    $site = e((string) config('site_name'));
    $year = date('Y');
    return "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        . "<style>body{font-family:Arial,Helvetica,sans-serif;background:#f4f7fc;margin:0;padding:24px;color:#1F2A37}"
        . ".card{max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(8,36,61,.08)}"
        . ".head{background:#005AA5;color:#fff;padding:20px 24px;font-size:18px;font-weight:700}"
        . ".body{padding:24px;line-height:1.6}.btn{display:inline-block;background:#005AA5;color:#fff!important;"
        . "text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600}"
        . ".foot{padding:16px 24px;font-size:12px;color:#5B6B82;border-top:1px solid #DFE6F0}</style></head><body>"
        . "<div class=\"card\"><div class=\"head\">$site</div><div class=\"body\">"
        . "<h1 style=\"font-size:20px;margin:0 0 12px\">" . e($title) . "</h1>$content</div>"
        . "<div class=\"foot\">&copy; $year $site</div></div></body></html>";
}

/** Formatea "Nombre <correo>". */
function mailer_format_address(string $email, string $name = ''): string
{
    $name = trim($name);
    if ($name === '') {
        return $email;
    }
    return sprintf('%s <%s>', mailer_encode_subject($name), $email);
}

/** Envio por SMTP con TLS/SSL opcional. */
function smtp_send(string $to, string $subject, string $html, string $text, array $cfg): bool
{
    $host   = $cfg['smtp_host'] ?? '';
    $port   = (int) ($cfg['smtp_port'] ?? 587);
    $user   = $cfg['smtp_user'] ?? '';
    $pass   = $cfg['smtp_pass'] ?? '';
    $secure = $cfg['smtp_secure'] ?? 'tls';

    if ($host === '') {
        app_log('SMTP sin host configurado');
        return false;
    }

    $prefix = $secure === 'ssl' ? 'ssl://' : '';
    $fp = @stream_socket_client($prefix . $host . ':' . $port, $errno, $errstr, 15);
    if (!$fp) {
        app_log("SMTP conexion fallida: $errstr ($errno)");
        return false;
    }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        $data = '';
        while ($line = fgets($fp, 515)) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $write = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };

    $read();
    $write('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
    $read();

    if ($secure === 'tls') {
        $write('STARTTLS');
        $read();
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            app_log('SMTP STARTTLS fallo');
            fclose($fp);
            return false;
        }
        $write('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
        $read();
    }

    if ($user !== '') {
        $write('AUTH LOGIN');
        $read();
        $write(base64_encode($user));
        $read();
        $write(base64_encode($pass));
        $authResp = $read();
        if (strpos($authResp, '235') === false) {
            // Registramos la respuesta del servidor (sin credenciales) para poder
            // diagnosticar: Gmail responde "535-5.7.8 Username and Password not accepted"
            // cuando se usa la contrasena normal en vez de una de aplicacion.
            app_log('SMTP autenticacion fallida: ' . trim(preg_replace('/\s+/', ' ', $authResp)));
            fclose($fp);
            return false;
        }
    }

    $fromEmail = $cfg['from_email'] ?? $user;
    $write('MAIL FROM:<' . $fromEmail . '>');
    $read();
    $write('RCPT TO:<' . $to . '>');
    $read();
    $write('DATA');
    $read();

    $boundary = 'b' . bin2hex(random_bytes(8));
    $headers  = [
        'From: ' . mailer_format_address($fromEmail, $cfg['from_name'] ?? ''),
        'To: <' . $to . '>',
        'Subject: ' . mailer_encode_subject($subject),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];
    $body = implode("\r\n", $headers) . "\r\n\r\n"
        . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n$text\r\n"
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n$html\r\n"
        . "--$boundary--";

    // Escapamos lineas que empiecen por punto.
    $body = preg_replace('/^\./m', '..', $body);
    $write($body . "\r\n.");
    $response = $read();
    $write('QUIT');
    fclose($fp);

    return strpos($response, '250') !== false;
}
