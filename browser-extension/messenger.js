var windows = {};
var lastNotificationTime = new Date().getTime();

if (typeof chrome.gcm !== "undefined") {
    chrome.gcm.onMessage.addListener(function(message) {
        console.log("got message");
        if (message.data.operation == "dismissed_notification") {
            var content = JSON.parse(message.data.contents);
            chrome.notifications.clear(content.id + "", function() {
                console.log("dismissed notification: " + content.id);
            });
        } else if (message.data.operation == "added_message") {
            chrome.storage.sync.get({
                displayNotifications: true,
                persistNotifications: false,
                showNotificationContent: true
            }, function(items) {
                if (items.displayNotifications == false) {
                    return;
                }

                chrome.storage.local.get(["account_id", "hash", "salt"], function(result) {
                    var accountId = result["account_id"];
                    var hash = result["hash"];
                    var salt = result["salt"];

                    var combinedKey = accountId + ":" + hash + "\n";
                    var key = sjcl.misc.pbkdf2(combinedKey, salt, 10000, 256, hmacSHA1);
                    var aes = new sjcl.cipher.aes(key);
                    sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();
                    var content = JSON.parse(message.data.contents);

                    if (content.type == 0) {
                        var text;

                        if (decrypt(content.mime_type, aes) == "text/plain") {
                            try {
                                text = decrypt(content.data, aes);
                            } catch (error) {
                                text = "New text received";
                            }
                        } else {
                            text = "New MMS received";
                        }

                        var url = "https://api.messenger.klinkerapps.com/api/v1/conversations/" +
                            content.conversation_id + "?account_id=" + accountId;

                        getJSON(url, function(data) {
                            var hideContent = data.private_notifications;
                            var opt = {
                                type: "basic",
                                title: hideContent || !items.showNotificationContent ? "New Message" : decrypt(data.title, aes),
                                message: hideContent || !items.showNotificationContent ? "" : text,
                                iconUrl: "assets/icon_48.png",
                                requireInteraction: items.persistNotifications,
                                priority: 2,
                                buttons: hideContent ? [] : [{
                                    title: "Reply",
                                    iconUrl: "assets/reply.png"
                                }, {
                                    title: "Mark as Read",
                                    iconUrl: "assets/read.png"
                                }]
                            };

                            if (data.read || data.mute || (new Date().getTime() - lastNotificationTime) < 20000) {
                                return;
                            }

                            lastNotificationTime = new Date().getTime();

                            chrome.notifications.create(content.conversation_id + "", opt, function() {
                                console.log("created notification");
                            });
                        });
                    }
                });
            });
        }
    });
}

chrome.notifications.onClicked.addListener(function(notificationId) {
    chrome.tabs.query({
        'url': 'https://pulsesms.app/*'
    }, function(tabs) {
        if (tabs.length == 0) {
            window.open("https://pulsesms.app/thread/" + notificationId);
        } else {
            chrome.tabs.update(tabs[0].id, {
                active: true,
                url: "https://pulsesms.app/thread/" + notificationId
            });
        }
    });

    chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
    if (buttonIndex === 0) {
        launchWindowedApplication(notificationId);
    } else if (buttonIndex === 1) {
        dismissNotification(notificationId);
    }

    chrome.notifications.clear(notificationId);
});

function launchWindowedApplication(id) {
    var conversationId = id + "";
    var url = "https://pulsesms.app/thread/" + conversationId;

    chrome.windows.create({
        'url': url,
        'height': 600,
        'width': 415,
        'type': 'popup'
    }, function(window) {

    });
}

var getJSON = function(url, successHandler) {
    var xhr = new XMLHttpRequest();
    xhr.open('get', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
        var status = xhr.status;
        if (status == 200) {
            successHandler && successHandler(xhr.response);
        }
    };
    xhr.send();
};

function dismissNotification(conversationId) {
    chrome.storage.local.get(["account_id"], function(result) {
        var accountId = result["account_id"];

        var xhr = new XMLHttpRequest();
        xhr.open('post', "https://api.messenger.klinkerapps.com/api/v1/accounts/dismissed_notification?account_id=" + accountId + "&id=" + conversationId, true);
        xhr.responseType = 'json';
        xhr.send();
    });
}

function decrypt(data, aes) {
    if (data == null) {
        return "";
    }

    var parts = data.split("-:-");
    return sjcl.codec.utf8String.fromBits(sjcl.mode.cbc.decrypt(aes, sjcl.codec.base64.toBits(parts[1]), sjcl.codec.base64.toBits(parts[0]), null));
}
