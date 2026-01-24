<?php
//https://telemetry.hytale.com/telemetry/client
$DEBUG = true;

if ($DEBUG == true) {
	$method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'POST') {
        // Get the raw POST data
        $postData = file_get_contents('php://input');
        
        $jsonData = json_decode($postData, true);
        if ($jsonData == null) {
            $content = "Invalid JSON or non-JSON data\n";
        } else {
        	#print_r($jsonData);
        	if ($jsonData['type'] == "session_start") {
        		$content = ["HighElfDebugLoopback" => $jsonData['client']];
        		// Store game vers
        		// $jsonData['client']['version']       // 2026.01.15-c04fdfe10
        		// $jsonData['client']['revision_id']   // c04fdfe1050a70829ff6aaf01da2d7d679220f86
        		// $jsonData['client']['configuration'] // Release
        		// $jsonData['client']['patchline']     // release
        	} else {
        		$content = ["HighElfDebugLoopback" => true];
        	}

        }
    
    } else {
    	$content = json_decode ("{}");
    }
    unset($method);
    header('Content-Type: application/json');
    echo json_encode($content);

} else {
	print("The HighElf debug loopback is disabled.<br>HighElf will NEVER look at or store your telemetry data. Ever.<br> I don't wan't that shit. its to much. <i>However</i>, I do need your client build id for debugging and testing, hence this debug loopback");

}

?>