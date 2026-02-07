<?php
// Simple script that dumps the jwks.json from the auth tokens server
// All auth trafic should now be handed by HighElf, formatted and then sent to the external auth server
// So the user only has to enter one url to forward traffic too.

if($_SERVER['SERVER_ADDR'] != '127.0.0.1' and $_SERVER['REMOTE_ADDR'] != '127.0.0.1'){
	die("You are not the owner of this server, you can not update jwt keys");
}

header('Content-Type: application/json');
require_once "../utils/get.php";

$dbPath = "../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$serverConfig = getServerConfigs($pdo);

//WARNING: almost no checking here outside of can it encode and decode as json..
$json = file_get_contents($serverConfig['authProvider'].'/.well-known/jwks.json');
$json = json_decode($json);
file_put_contents('jwks.json', json_encode($json));
$output['success'] = true;
$output['time'] = time();
$output['jwks'] = $json;
$output = json_encode($output);
unset($json);
print($output);
unset($output);
?>
