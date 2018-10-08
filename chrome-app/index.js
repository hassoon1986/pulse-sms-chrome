webview = document.getElementById('messenger');
webview.addEventListener("contentload", function() {
    webview.contentWindow.postMessage("requesting account id", "*");
});

var messageHandler = function(event) {
    if (event.data.startsWith("account id: ")) {
        var id = event.data.replace("account id: ", "");
        console.log("got account id");
        chrome.storage.local.set({ "account_id": id });
        chrome.storage.local.get(["old_account_id"], function(result) {
	        var oldId = result["old_account_id"];
	        if (!oldId || oldId != id) {
                console.log("Clearing FCM registration - account ids don't match.");
        		chrome.storage.local.set({ "old_account_id": id });
        		chrome.storage.local.set({ "registration_token": null });
	        }
	        register(id);
	    });
        webview.contentWindow.postMessage("requesting hash", "*");
    } else if (event.data.startsWith("hash: ")) {
        var hash = event.data.replace("hash: ", "");
        console.log("got hash");
        chrome.storage.local.set({ "hash": hash });
        webview.contentWindow.postMessage("requesting salt", "*");
    } else if (event.data.startsWith("salt: ")) {
        var salt = event.data.replace("salt: ", "");
        console.log("got salt");
        chrome.storage.local.set({ "salt": salt });
    }
};

window.addEventListener('message', messageHandler, false);

var register = function(accountId) {
    chrome.storage.local.get(["registration_token"], function(result) {
        var registrationToken = result["registration_token"];

        if (!registrationToken && accountId) {
            console.log("have account id but no registration token, registering");
            try {
              chrome.gcm.register(["957154022410"], function(token) {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                    console.log("quiting fcm registration");
                    return;
                }

                chrome.storage.local.set({ "registration_token": token });

                // post to server to register as new device (no jquery)
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "https://api.messenger.klinkerapps.com/api/v1/devices/add", true);
                xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

                var data = {
                    account_id: accountId,
                    info: "Chrome App",
                    name: "Chrome App",
                    primary: false,
                    fcm_token: token
                };

                xhr.send(JSON.stringify(data));

                console.log("registered with fcm!");
            });
          } catch(err) {
            
          }
        } else {
            console.log("not registering");
        }
    });
};

try {
  chrome.gcm.onMessage.addListener(function(message) {
      var operation = message.data.operation;
      if (operation.endsWith("message")) {
          var content = JSON.parse(message.data.contents);
          operation = operation + content.conversation_id;
      }

      console.log(operation);
      webview.contentWindow.postMessage(operation, "*");
  });
} catch(err) {

}
