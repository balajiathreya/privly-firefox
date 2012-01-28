privly_server_url = "https://priv.ly";
//privly_server_url = "http://localhost:3000";

privlyFlags = {
  //when the server is down and we don't want any further requests to the server.
  noRequests: false,
  //disablePosts - when we don't want the extension to post content to the server.
  disablePosts: false,
  //when the server is busy and we don't want the extension to replace links on the page.
  requireClickthrough: false,
  //all posts default to public
  allPostsPublic: false
};

var privlyExtension = 
{
  loadLibraries : function(evt)
  {
    var doc = evt.originalTarget;
    var wnd = doc.defaultView;
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    
    //load the script running on the host page
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
          data: { auth_token: privly_user_auth_token, "post[content]":value, 
            "post[public]":privlyFlags.allPostsPublic,
            endpoint:"extension", browser:"firefox", version:"0.1.1.1"
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

Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader).loadSubScript("chrome://privly/content/jquery-1.7.1.min.js",window);
jQ = window.jQuery.noConflict();

window.addEventListener("load", function (e){
  var appcontent = document.getElementById("appcontent");
  if( appcontent ) {
    appcontent.addEventListener("DOMContentLoaded", privlyExtension.loadLibraries, true);
  }
}, false);
window.addEventListener("IframeResizeEvent", function(e) { privlyExtension.resizeIframe(e); }, false, true);
window.addEventListener("contextmenu", function(e) { privlyExtension.checkContextForPrivly(e);}, false);
