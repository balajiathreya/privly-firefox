//privly_server_url = "https://priv.ly";
privly_server_url = "http://localhost:3000";

privly_user_auth_token = "";

privlyFlags = {
	//when the server is down and we don't want any further requests to the server.
	noRequests: false,
	//disablePosts - when we don't want the extension to post content to the server.
	disablePosts: false,
	//when the server is busy and we don't want the extension to replace links on the page.
	requireClickthrough: false
};
		
// This is a temporary fix. We need to implement this in an XPCOM
//
// From: https://developer.mozilla.org/en/Setting_HTTP_request_headers
// You need to register a single http-on-modify-request observer per
// application (and not one per window). This means that you should
// put the observer's implementation in an XPCOM component instead
// of an overlay. If you want to support Gecko2 (Firefox4) you need
// to register your javascript component as described here:
// https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_2.0#JavaScript_components.

var privlyExtension = 
{
	httpRequestObserver :
	{		
		observe: function(subject, topic, data)
		{
			if (topic == "http-on-modify-request") 
			{
				var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
				//cancel iframe requests to priv.ly when requireClickthrough is set.
				//cancel all requests to priv.ly when noRequests is set
				if (privlyFlags.noRequests == true || privlyFlags.requireClickthrough == true)
				{
					if ((/priv.ly/.test(httpChannel.originalURI.host) || (/localhost/.test(httpChannel.originalURI.host))))
					{
						if(privlyFlags.noRequests == true || (/.iframe/g).test(httpChannel.originalURI.path))
						{
							subject.cancel(Components.results.NS_BINDING_ABORTED);
							convertIframesToLinks();
						}
					}
				}
				if (/priv.ly/.test(httpChannel.originalURI.host))
				{
					httpChannel.setRequestHeader("Privly-Version", "0.1.1.1", false);
					httpChannel.setRequestHeader("auth_token", privly_user_auth_token, false);
				}
				else if(/localhost/.test(httpChannel.originalURI.host))
				{
					httpChannel.setRequestHeader("Privly-Version", "0.1.1.1", false);
					httpChannel.setRequestHeader("auth_token", privly_user_auth_token, false);
				}
			}
		},
	
		get observerService() {
			return Components.classes["@mozilla.org/observer-service;1"]
											.getService(Components.interfaces.nsIObserverService);
		},
	
		register: function()
		{
			this.observerService.addObserver(this, "http-on-modify-request", false);
		},
	
		unregister: function()
		{
			this.observerService.removeObserver(this, "http-on-modify-request");
		}
	},
	
	httpResponseObserver :
	{
		observe: function(subject, topic, data)
		{
			if (topic == "http-on-examine-response") {
				var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
				//read the extensionCommand header from the response. if the response header is not set or the server 
				//didn't reply, it will throw an error. so catch it
				try{
					extensionCommand = httpChannel.getResponseHeader("privlyExtensionCommand");
					
					if (/priv.ly/.test(httpChannel.originalURI.host) || (/localhost/.test(httpChannel.originalURI.host) && /posts/.test(httpChannel.originalURI.path)))
					{ 
						//the extensioncommand response header will be a json string. So far 3 params are identified.
						//disableIframes and requireClickthrough are mutually exclusive. Only one should appear in the header string.
						//eg - extensionCommand = '{"noRequests": 100,"disablePosts" : 200, requireClickthrough:110}';
						extensionCommand = '';
						command = jQ.parseJSON(extensionCommand);
						if(command && command.noRequests){
							privlyFlags.noRequests = true;
							setTimeout("privlyFlags.noRequests=false",command.noRequests);
						}
						if(command && command.disablePosts){
							privlyFlags.disablePosts = true;
							setTimeout("privlyFlags.disablePosts=false",command.disablePosts);
						} 
						if(command && command.requireClickthrough){
							privlyFlags.requireClickthrough = true;
							setTimeout("privlyFlags.requireClickthrough=false",command.requireClickthrough);
						}
					}
				}
				catch(err){}
			}
		},
	
		get observerService() {
			return Components.classes["@mozilla.org/observer-service;1"]
											.getService(Components.interfaces.nsIObserverService);
		},
	
		register: function()
		{
			this.observerService.addObserver(this, "http-on-examine-response", false);
		},
	
		unregister: function()
		{
			this.observerService.removeObserver(this, "http-on-examine-response");
		}
	},			
	
	loadLibraries : function(evt)
	{
		var doc = evt.originalTarget;
		var wnd = doc.defaultView;
		var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
		
		// load jQuery and save it as a property of the window
		loader.loadSubScript("chrome://privly/content/jquery-1.7.js",wnd);
		loader.loadSubScript("chrome://privly/content/privly.js", wnd);
	},
	
	runPrivly : function()
	{
		var pwbutton = content.document.getElementById('pwbtn');
		if(pwbutton)
			pwbutton.click();
	},
	
	postToPrivly : function()
	{
		var target = document.popupNode;
		var value = target.value;
		if(value == "")
			alert("Sorry. You can not post empty content to Privly");
		else{
		jQ.ajax(
			{
				data: { auth_token: privly_user_auth_token, "post[content]":value, endpoint:"extension",
					browser:"firefox",version:"0.1.1.1"
				},
						type: "POST",
						url: privly_server_url+"/posts",
						contentType: "application/x-www-form-urlencoded; charset=UTF-8", 
						success: function(data, textStatus, jqXHR){
							target.value=jqXHR.getResponseHeader("privlyurl");
				}
			}
			);
		}
	},
	
	loginToPrivly : function()
	{
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
													.getService(Components.interfaces.nsIPromptService);
		var email = {value: ""};
		var password = {value: ""};
		var result = prompts.promptUsernameAndPassword(null, "Privly Authentication", "Enter your Privly email and password:",
																								email, password, "", {});
		userEmailAddress = email.value;
		userPassword = password.value;
																								
		jQ.ajax(
			{
				data: { email: userEmailAddress, password: userPassword,
					endpoint:"extension", browser:"firefox", version:"0.1.1.1"
				},
				type: "POST",
				url: privly_server_url+"/token_authentications.json",
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",
				success: function(data, textStatus, jqXHR){
					privly_user_auth_token = data.auth_key;
					if(privly_user_auth_token)
					{
						alert("You are now logged into Privly");
					}
					else
					{
						alert("Incorrect email or password for Priv.ly login");
					}
				}
			}
		);
	},
	
	logoutFromPrivly : function()
	{
		jQ.ajax(
			{
				data: { _method: "delete", endpoint:"extension", browser:"firefox", 
					version:"0.1.1.1", auth_token: privly_user_auth_token
				},
				type: "POST",
				url: privly_server_url+"/token_authentications.json",
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",
				success: function(data, textStatus, jqXHR){
					privly_user_auth_token = "";
					alert("You are logged out from Priv.ly");
				},
				error: function(data, textStatus, jqXHR){
					alert(data.error);
				}
			}
		);
	},
	
	/*
	 *when the server is down/busy, this function is called to convert the privly iframes to anchors on the web page 
	 *depending upon the privlyFlags set in the extensionCommand header.
	 */
	convertIframesToLinks : function()
	{
		privlyIframes = content.document.getElementsByName("privlyiframe");
		if(privlyIframes.length > 0){
			for(i = 0; i< privlyIframes.length; i++){
				var anchor = content.document.createElement("a");
				var href = privlyIframes[i].src;
				href = href.substring(0,href.indexOf(".iframe"));
				anchor.setAttribute('href',href);
				if(privlyFlags.noRequests)
				{
						anchor.innerHTML = "Privly temporarily disabled all requests to its servers. Please try again later.";
				}
				else if(privlyFlags.requireClickthrough)
				{
						anchor.innerHTML = "Privly is in sleep mode so it can catch up with demand. The content may still be viewable by clicking this link";
				}
				privlyIframes[i].parentNode.replaceChild(anchor,privlyIframes[i]);
			}
		}
	},
	
	resizeIframe : function(evt)
	{
		var iframeHeight = evt.target.getAttribute("height");
		var ifr = evt.target.ownerDocument.defaultView.frameElement;
		ifr.style.height = iframeHeight+'px';
	},
	
	checkContextForPrivly : function(evt)
	{
		
		var loginToPrivlyMenuItem = document.getElementById('loginToPrivlyMenuItem'); 
		var logoutFromPrivlyMenuItem = document.getElementById('logoutFromPrivlyMenuItem');   
		var postToPrivlyMenuItem = document.getElementById('postToPrivlyMenuItem');
	
		if(privly_user_auth_token)
		{
			loginToPrivlyMenuItem.hidden = true;
			logoutFromPrivlyMenuItem.hidden = false;
			if(!privlyFlags.disablePosts && evt.target.nodeName != null && (evt.target.nodeName.toLowerCase() == 'input' || evt.target.nodeName.toLowerCase() == 'textarea')){
				postToPrivlyMenuItem.hidden = false;
			}
			else {
				postToPrivlyMenuItem.hidden = true;
			}
		}
		else
		{
			loginToPrivlyMenuItem.hidden = false;
			logoutFromPrivlyMenuItem.hidden = true;
			postToPrivlyMenuItem.hidden = true;
		}
	}
}

Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader).loadSubScript("chrome://privly/content/jquery-1.7.js",window);
window.jQ.noConflict();

privlyExtension.httpRequestObserver.register();
privlyExtension.httpResponseObserver.register();

function onPgeLd(event)
{
	var appcontent = document.getElementById("appcontent");
	if( appcontent ) {
		appcontent.addEventListener("DOMContentLoaded", privlyExtension.loadLibraries, true);
	}
}

	
window.addEventListener("load", onPgeLd, false);
window.addEventListener("IframeResizeEvent", function(e) { privlyExtension.resizeIframe(e); }, false, true);
window.addEventListener("contextmenu", function(e) { privlyExtension.checkContextForPrivly(e);}, false);
