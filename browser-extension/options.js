function save_options() {
  var notifications = document.getElementById('notifications').checked;
  var shouldPersistNotifications = document.getElementById('persist_notifications').checked;
  var optionsBar = document.getElementById('options_bar').checked;
  var notificationContentPref = document.getElementById('notification_content').checked;
  chrome.storage.sync.set({
    displayNotifications: notifications,
    persistNotifications: shouldPersistNotifications,
    displayOptionsBar: optionsBar,
    showNotificationContent: notificationContentPref
  }, function() {
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 2000);
  });
}

function restore_options() {
  chrome.storage.sync.get({
    displayNotifications: true,
    displayOptionsBar: true,
    persistNotifications: false,
    showNotificationContent: true
  }, function(items) {
    document.getElementById('notifications').checked = items.displayNotifications;
    document.getElementById('options_bar').checked = items.displayOptionsBar;
    document.getElementById('persist_notifications').checked = items.persistNotifications;
    document.getElementById('notification_content').checked = items.showNotificationContent;
  });

  document.getElementById('reregister').addEventListener("click", function() {
      chrome.storage.local.get(["account_id"], function(result) {
        var accountId = result["account_id"];
        registerWithFirebase(accountId);
      });

      this.parentNode.removeChild(this);
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);

var registerWithFirebase = function(accountId) {
  chrome.gcm.register(["957154022410"], function(token) {
      if (chrome.runtime.lastError) {
          // error registering with gcm, will try on next launch
          console.log(chrome.runtime.lastError)
          return;
      }

      chrome.storage.local.set({ "registration_token": token });

      // post to server to register as new device (no jquery)
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.messenger.klinkerapps.com/api/v1/devices/add", true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

      var data = {
          account_id: accountId,
          info: "Chrome Extension",
          name: "Chrome Extension",
          primary: false,
          fcm_token: token
      };

      xhr.send(JSON.stringify(data));

      console.log("registered with fcm!");
  });
}
