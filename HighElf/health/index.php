<?php
//??.hytale.com/health
//Not sure what this is for, I can't find it on the real servers, but it's in sanasols emulator..
//So ima hijack it a little... just edit the server string. So our launcher can check what ver of HighElf we are running and if our launcher config is valid.
//If you want even more info about the HighElf server, visit HighElf/my-account/get-launcher-data/?os=all
//TODO: Maybe load this ver number from somewhere else more central.
require_once "../utils/config.php";

// Connect to SQLite database
$dbPath = "../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$serverConfig = getServerConfigs($pdo);

header('Content-Type: application/json');
$data = ['status'=>'ok', 'server'=>$serverConfig['name'], 'domain'=>$_SERVER['SERVER_NAME'], 'HighElf'=>'20260202-beta'];
echo json_encode( $data );
?>