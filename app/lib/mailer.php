<?php
declare(strict_types=1);

/**
 * ============================================================================
 *  ENVIO DE CORREO
 *  Modos: 'mail' (funcion mail()), 'smtp' (servidor SMTP) y 'log' (pruebas).
 *  El modo SMTP habla el protocolo directamente por socket, sin dependencias.
 * ============================================================================
 */

/** Guarda el motivo del último fallo de envío (para mostrarlo en el panel). */
function mailer_set_error(string $message): void
{
    $GLOBALS['CROTULUS_MAIL_ERROR'] = $message;
    app_log('MAIL: ' . $message);
}

/** Motivo del último fallo de envío (cadena vacía si todo fue bien). */
function mailer_last_error(): string
{
    return (string) ($GLOBALS['CROTULUS_MAIL_ERROR'] ?? '');
}

/**
 * Correo que recibe los avisos del sitio (contacto, aportaciones, valoraciones).
 * Prioridad: ajuste 'mail_to_email' -> ajuste 'correo' -> config.
 * Devuelve '' si no hay ninguna dirección válida configurada.
 */
function mail_notify_to(): string
{
    foreach ([(string) config('mail.to_email', ''), setting('correo', config('defaults.correo', ''))] as $candidate) {
        $candidate = trim($candidate);
        if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
            return $candidate;
        }
    }
    return '';
}

/**
 * Correo remitente efectivo.
 * Si 'from_email' está vacío o no es válido, se usa el usuario SMTP. Esto es
 * obligatorio en Gmail: el remitente (From) debe ser la misma cuenta que
 * autentica, o el servidor rechaza el envío ("From address not allowed").
 */
function mailer_from_email(array $cfg): string
{
    $from = trim((string) ($cfg['from_email'] ?? ''));
    if ($from !== '' && filter_var($from, FILTER_VALIDATE_EMAIL)) {
        return $from;
    }
    $user = trim((string) ($cfg['smtp_user'] ?? ''));
    if (filter_var($user, FILTER_VALIDATE_EMAIL)) {
        return $user;
    }
    return 'no-reply@localhost';
}

/**
 * Envia un correo. Devuelve true si se entrego/encolo correctamente.
 * $replyTo permite que, al responder el aviso, el correo vaya al cliente.
 */
function send_mail(string $to, string $subject, string $htmlBody, string $textBody = '', string $replyTo = ''): bool
{
    $cfg       = config('mail');
    $fromEmail = mailer_from_email($cfg);
    $fromName  = $cfg['from_name'] ?? '';
    $transport = $cfg['transport'] ?? 'log';

    // Reinicia el error anterior para no arrastrar mensajes antiguos.
    $GLOBALS['CROTULUS_MAIL_ERROR'] = '';

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
        return smtp_send($to, $subject, $htmlBody, $textBody, $cfg, $replyTo);
    }

    // Modo 'mail' nativo
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . mailer_format_address($fromEmail, $fromName),
        'Reply-To: ' . (filter_var($replyTo, FILTER_VALIDATE_EMAIL) ? $replyTo : $fromEmail),
        'X-Mailer: C-ROTULUS',
    ];
    $ok = @mail($to, mailer_encode_subject($subject), $htmlBody, implode("\r\n", $headers));
    if (!$ok) {
        mailer_set_error("La funcion mail() del hosting rechazo el envio a $to.");
    }
    return $ok;
}

/** Codifica el asunto con acentos correctamente. */
function mailer_encode_subject(string $subject): string
{
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

/**
 * Pliega lineas largas al limite de SMTP (RFC 5321: 1000 bytes por linea,
 * contando el CRLF). Sin esto, un correo HTML con el <style> en una sola
 * linea supera el limite y servidores estrictos lo rechazan con
 * "500 Line too long". Prefiere cortar por un espacio cercano y, si no lo
 * hay, corta en seco sin partir un caracter UTF-8 a la mitad.
 */
function mailer_fold_lines(string $text, int $limit = 998): string
{
    $out = [];
    foreach (preg_split('/\r\n|\n|\r/', $text) as $line) {
        while (strlen($line) > $limit) {
            $chunk = substr($line, 0, $limit);
            $cut   = strrpos($chunk, ' ');
            if ($cut === false || $cut < $limit - 200) {
                $cut = $limit;
                // Retrocede si el corte cae dentro de un caracter multibyte.
                while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) {
                    $cut--;
                }
            }
            $out[] = substr($line, 0, $cut);
            $line  = ltrim(substr($line, $cut));
        }
        $out[] = $line;
    }
    return implode("\r\n", $out);
}

/** Plantilla HTML basica para los correos transaccionales. */
function mailer_template(string $title, string $content): string
{
    $site = e((string) config('site_name'));
    $year = date('Y');
    return "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
        . "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        . "<style>body{font-family:Arial,Helvetica,sans-serif;background:#F4F8FB;margin:0;padding:24px;color:#17303F}"
        . ".card{max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(11,46,69,.08)}"
        . ".head{background:#136493;color:#fff;padding:20px 24px;font-size:18px;font-weight:700}"
        . ".body{padding:24px;line-height:1.6}.btn{display:inline-block;background:#136493;color:#fff!important;"
        . "text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600}"
        . ".foot{padding:16px 24px;font-size:12px;color:#4F6474;border-top:1px solid #DDE7EE}</style></head><body>"
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

/**
 * Envio por SMTP con TLS/SSL opcional.
 * Comprueba el codigo de respuesta de CADA comando: si el servidor rechaza
 * MAIL FROM / RCPT TO / DATA, se registra el motivo exacto y se devuelve false.
 * (Antes solo se miraba la ultima respuesta, por lo que un rechazo real podia
 * pasar por exito. Es la causa tipica de "el formulario dice OK pero no llega
 * el correo" con Gmail.)
 */
function smtp_send(string $to, string $subject, string $html, string $text, array $cfg, string $replyTo = ''): bool
{
    $host   = $cfg['smtp_host'] ?? '';
    $port   = (int) ($cfg['smtp_port'] ?? 587);
    $user   = $cfg['smtp_user'] ?? '';
    $pass   = $cfg['smtp_pass'] ?? '';
    $secure = $cfg['smtp_secure'] ?? 'tls';

    if ($host === '') {
        mailer_set_error('SMTP sin servidor configurado.');
        return false;
    }

    $prefix = $secure === 'ssl' ? 'ssl://' : '';
    $fp = @stream_socket_client($prefix . $host . ':' . $port, $errno, $errstr, 15);
    if (!$fp) {
        mailer_set_error("No se pudo conectar a $host:$port ($errstr)");
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
    // Devuelve true si la respuesta SMTP empieza por el codigo esperado.
    $expect = function (string $resp, string $code) use ($fp): bool {
        if (strpos(ltrim($resp), $code) === 0) {
            return true;
        }
        mailer_set_error('El servidor SMTP respondio: ' . trim(preg_replace('/\s+/', ' ', $resp)));
        fclose($fp);
        return false;
    };

    $expect($read(), '220');

    $ehloHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
    $write('EHLO ' . $ehloHost);
    $expect($read(), '250');

    if ($secure === 'tls') {
        $write('STARTTLS');
        if (!$expect($read(), '220')) {
            return false;
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            mailer_set_error('No se pudo iniciar el cifrado TLS (STARTTLS).');
            fclose($fp);
            return false;
        }
        $write('EHLO ' . $ehloHost);
        $expect($read(), '250');
    }

    if ($user !== '') {
        $write('AUTH LOGIN');
        $expect($read(), '334');
        $write(base64_encode($user));
        $expect($read(), '334');
        $write(base64_encode($pass));
        $authResp = $read();
        if (strpos($authResp, '235') === false) {
            // Gmail responde "535-5.7.8 Username and Password not accepted"
            // cuando se usa la contrasena normal en vez de una de aplicacion.
            mailer_set_error('Autenticacion SMTP fallida. Con Gmail usa una contrasena de aplicacion. Respuesta: ' . trim(preg_replace('/\s+/', ' ', $authResp)));
            fclose($fp);
            return false;
        }
    }

    // El remitente debe coincidir con la cuenta autenticada en Gmail.
    $fromEmail = mailer_from_email($cfg);
    $write('MAIL FROM:<' . $fromEmail . '>');
    if (!$expect($read(), '250')) {
        return false;
    }

    $write('RCPT TO:<' . $to . '>');
    $rcptResp = $read();
    if (strpos($rcptResp, '250') === false && strpos($rcptResp, '251') === false) {
        mailer_set_error('El destinatario fue rechazado: ' . trim(preg_replace('/\s+/', ' ', $rcptResp)));
        fclose($fp);
        return false;
    }

    $write('DATA');
    if (!$expect($read(), '354')) {
        return false;
    }

    $boundary = 'b' . bin2hex(random_bytes(8));
    $headers  = [
        'From: ' . mailer_format_address($fromEmail, $cfg['from_name'] ?? ''),
        'To: <' . $to . '>',
        'Subject: ' . mailer_encode_subject($subject),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];
    if (filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: <' . $replyTo . '>';
    }
    $body = implode("\r\n", $headers) . "\r\n\r\n"
        . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n$text\r\n"
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n$html\r\n"
        . "--$boundary--";

    // Plegamos lineas largas (el <style> del HTML va en una sola linea) para
    // respetar el limite de 1000 bytes de SMTP. Evita el error "Line too long".
    $body = mailer_fold_lines($body);
    // Escapamos lineas que empiecen por punto.
    $body = preg_replace('/^\./m', '..', $body);
    $write($body . "\r\n.");
    $response = $read();
    $write('QUIT');
    fclose($fp);

    if (strpos($response, '250') === false) {
        mailer_set_error('El servidor SMTP no acepto el mensaje: ' . trim(preg_replace('/\s+/', ' ', $response)));
        return false;
    }
    return true;
}
