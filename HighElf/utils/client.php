<?php

function IPChunk() {
    $clientRequiredKeys = [
        'HTTP_USER_AGENT',
        'HTTP_ACCEPT',
        'REMOTE_ADDR',
        //'GEOIP_COUNTRY_CODE',
    ];
    $serverRequiredKeys = ['SERVER_ADDR'];
    $success = true; // ASSume success initially

    // Check for missing client keys
    $noMissingClientKeys = true;
    foreach ($clientRequiredKeys as $key) {
        if (!isset($_SERVER[$key])) {
            $noMissingClientKeys = false;
            $success = false; // Mark overall success as false
            break;
        }
    }

    // Generate client tokens or set to null
    if ($noMissingClientKeys) {
        $userIP = str_split(sha1($_SERVER['REMOTE_ADDR'], 20));
        $IPOut = strtoupper(substr(hash('whirlpool', $userIP[1].$userIP[0]), -18));
        //$clientSFP = $_SERVER['HTTP_USER_AGENT'] . $_SERVER['GEOIP_COUNTRY_CODE'] . $_SERVER['HTTP_ACCEPT'] . $_SERVER['REMOTE_ADDR'];
        $clientSFP = $_SERVER['HTTP_USER_AGENT'] . $_SERVER['HTTP_ACCEPT'] . $_SERVER['REMOTE_ADDR'];
        $clientFP = strtoupper(substr(hash('whirlpool', $clientSFP[1].$clientSFP[0]), -18));
        $clientFullToken = $IPOut.$clientFP;
        unset($userIP);
        unset($clientSFP);
    } else {
        $clientFullToken = null;
        $clientFP = null;
        $IPOut = null; // Represents clientIP
    }

    // Check for missing server keys
    $noMissingServerKeys = true;
    foreach ($serverRequiredKeys as $key) {
        if (!isset($_SERVER[$key])) {
            $noMissingServerKeys = false;
            $success = false; // Mark overall success as false
            break;
        }
    }

    // Generate server token or set to null
    $serverFullToken = null; // Initialize to null
    if ($noMissingServerKeys) {
        if (function_exists('serverAuth')) {
        $serverIP = str_split(sha1($_SERVER['SERVER_ADDR'], 20));
        $IPOut2 = strtoupper(substr(hash('whirlpool', $serverIP[1].$serverIP[0]), -18));
        $serverFullToken = $IPOut2.serverAuth();
        } else {
            $success = false; // serverAuth function missing, overall failure
        }
    }

    return [
        'success' => $success,
        'clientToken' => $clientFullToken,
        'serverToken' => $serverFullToken,
        'clientFP' => $clientFP,
        'clientIP' => $IPOut,
    ];
}

#$test=IPChunk();
#print_r($test);


?>