<?php
//https://account-data.hytale.com/my-account/cosmetics
require_once "../../utils/valadate.php";

// Connect to SQLite database
$dbPath = "../../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Valadate client, get session id and account data.
$clientVer = valadateClient($pdo);
[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);

//PLEASE NOTE: The way client ver is formatted, it may end up being os specific, based on the build hash / id?
//when it probs shouldn't be. if I find a good way to run the mac or linux vers of hytale we can test this more.

//Load waights for this game clinet
//WARNING: we are expecting valadateClient to do corect string excapes for this
$rawdata = file_get_contents("data/".$clientVer."-weights.json");
$weights = json_decode($rawdata, true);
$entitlements = json_decode($UserInfo['entitlements'], true);

// Safty check: remove loaded entitlements not in weights array
// So we only load cosmetics we know about and have exported data for.
if ($entitlements == null){ $entitlements = [array_key_first($weights)];}
$entitlements = array_filter($entitlements, function($item) use ($weights) {
    return isset($weights[$item]);
});

// Sort entitlements by weights, remove any entitlements that are not valid.
usort($entitlements, function($a, $b) use ($weights) {
    return $weights[$a] <=> $weights[$b];
});

// Safty check: make sure game.base is loaded at 0th index.
if (empty($entitlements) or $entitlements[0] !== array_key_first($weights)) {
	// Remove game.base if it exists elsewhere
	$entitlements = array_diff($entitlements, [array_key_first($weights)]);
	// Reset array keys and add game.base at index 0
	$entitlements = array_values($entitlements);
	array_unshift($entitlements, array_key_first($weights));
}

// Now we have our sorted list of entitlements (witch I get we probs dident need to sort, but I dont trust anyone)
// Load the json for each entitlement
// print_r($entitlements);

$mergedData = [];
foreach ($entitlements as $entitlement) {
    $filename = "data/{$clientVer}-{$entitlement}.json";
    $jsonContent = file_get_contents($filename);
    $data = json_decode($jsonContent, true);

    // Merge the data
    foreach ($data as $category => $values) {
        // Initialize category if it doesn't exist
        if (!isset($mergedData[$category])) {
            $mergedData[$category] = [];
        }
        
        // Add only unique values to this category
        foreach ($values as $value) {
            if (!in_array($value, $mergedData[$category], true)) {
                $mergedData[$category][] = $value;
            }
        }
    }
}

//$json = file_get_contents('index.json'); 
//$json_data = json_decode($json, true); 
header('Content-type: application/json');
echo json_encode( $mergedData );
die();