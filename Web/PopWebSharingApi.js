
function GetElementMeta(Element,Key,Default)
{
	if (!Element)
		return undefined;

	//	check variable on object
	if (Element[Key] !== undefined)
	{
		return Element[Key];
	}

	//	check html attribute
	if (Element.getAttribute(Key) !== undefined)
	{
		return Element.getAttribute(Key);
	}

	return;
}

function GetShareMeta(Element)
{
	const ShareMeta =
	{
		text: document.title,
		url: window.location.href,
	}

	ShareMeta.text = GetElementMeta(Element,'ShareText') || ShareMeta.text;
	ShareMeta.url = GetElementMeta(Element,'ShareUrl') || ShareMeta.url;

	return ShareMeta;
}

function IsShareLinkSupported()
{
	//	mobile share api
	if (navigator.share)
		return true;

	//	clipboard api (secure only)
	if (navigator.clipboard)
		return true;

	return false;
}

function ShareLink(Element)
{
	const ShareMeta = GetShareMeta(Element);
	function OldCopyToClipboard()
	{
		//	todo: make a text box, copy text, exec command(copy)
		if (!document.execCommand)
			throw "execCommand missing, cannot copy to clipboard";
		/*
		//	https://www.w3schools.com/howto/howto_js_copy_clipboard.asp
		ShareMeta.url.select();
		ShareMeta.url.setSelectionRange(0, 99999)
		document.execCommand("copy");
		alert("Copied " + ShareMeta.url +" to clipboard");
		 */
	}

	function CopyToClipboard(ClickEvent)
	{
		//	use clipboard api
		if (!navigator.clipboard)
		{
			OldCopyToClipboard();
			return;
		}

		function OnCopy()
		{
			alert("Copied " + ShareMeta.url + " to clipboard");
		}
		function OnError(Error)
		{
			console.warn("navigator.clipboard.writeText error ",Error);
			OldCopyToClipboard();
		}

		navigator.clipboard.writeText(ShareMeta.url).then(OnCopy).catch(OnError);
	}

	//	use native (ie. ios) sharing
	if (navigator.share)
	{
		navigator.share(ShareMeta).then(console.log).catch(CopyToClipboard);
	}
	else
	{
		CopyToClipboard();
	}

	return false;	//	preventDefault
}

//					<!-- async="" src="https://platform.twitter.com/widgets.js" charset="utf-8" -->
function ShareTweet(Element)
{
	Element.setAttribute('target','_blank');

	const ShareMeta = GetShareMeta(Element);
	//	inject text into url for sharing
	let Url = 'https://twitter.com/intent/tweet?';//Element.getAttribute('href');
	const TwitterTextPrefix = "text=";
	Url += TwitterTextPrefix + ShareMeta.text + " " + ShareMeta.url;
	Element.setAttribute('href',Url);

	//	DONT prevent default so browser runs the href link click
}

function ShareFacebook(Element)
{
	Element.setAttribute('target','_blank');

	const ShareMeta = GetShareMeta(Element);
	//	inject text into url for sharing
	let Url = 'https://www.facebook.com/sharer/sharer.php?';
	Url += 'u=' + ShareMeta.url;
	//	this no longer works, url only
	//Url += '&quote=THE_CUSTOM_TEXT';

	Element.setAttribute('href',Url);

	//	DONT prevent default so browser runs the href link click
}


function ShareLinkedIn(Element)
{
	Element.setAttribute('target','_blank');

	const ShareMeta = GetShareMeta(Element);
	//	inject text into url for sharing
	let Url = 'https://www.linkedin.com/shareArticle?mini=true&';

	if (ShareMeta.url)
		Url += 'url=' + encodeURI(ShareMeta.url);
	/* gr: these no longer work, url only
	if (ShareMeta.title)
		Url += '&title=' + ShareMeta.title;
	if (ShareMeta.text)
		Url += '&summary=' + ShareMeta.text;
	*/
	Element.setAttribute('href',Url);

	//	DONT prevent default so browser runs the href link click
}

function HideElementsIfShareLinkUnsupported(ClassName)
{
	try
	{
		if (IsShareLinkSupported())
			return;

		const Elements = document.querySelectorAll('.' +ClassName);
		console.log("ShareLink not supported, hiding elements",Elements);
		for (let Element of Elements)
		{
			Element.style.display = 'none';
		}
	}
	catch (e)
	{
		console.error(e);
	}
}
