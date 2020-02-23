
//	we should make this as close to Pop.Gui as possible really... and re-use it for web
//	but for now, lets just mess with the DOM
Pop.Hud = {};

function EnableCssAnimation(Element)
{
	if (!Element)
		return;

	//	restart
	const AnimName = Element.style.animationName;
	Element.style.animationName = '';
	Element.style.animationName = AnimName;
	Element.style.animationPlayState = "running";
	Pop.Debug("Enabling anim on ",Element);
}

Pop.Hud.Slider = function()
{
	Pop.Gui.Slider.apply( this, arguments );
	
	this.VisibleCache = null;
	
	this.SetVisible = function(Visible)
	{
		if ( !this.Element )
			return;
		
		//	avoid style changes
		if ( this.VisibleCache === Visible )
			return;
		
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'inherit' : 'hidden';
		this.VisibleCache = Visible;
		if (Visible)
			EnableCssAnimation(this.Element);
	}
}

Pop.Hud.Label = function()
{
	Pop.Gui.Label.apply( this, arguments );

	this.VisibleCache = null;
	
	this.SetVisible = function(Visible)
	{
		if ( !this.Element )
			return;
		
		//	avoid style changes
		if ( this.VisibleCache === Visible )
			return;
		
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'inherit' : 'hidden';
		this.VisibleCache = Visible;
		if (Visible)
			EnableCssAnimation(this.Element);
	}
}

//	reference to a button
Pop.Hud.Button = function()
{
	Pop.Gui.Button.apply( this, arguments );
	
	this.VisibleCache = null;
	
	this.IsVisible = function()
	{
		if ( !this.Element )
			return false;
		
		return this.Element.style.visibility != 'hidden';
	}
	
	this.SetVisible = function(Visible)
	{
		if ( !this.Element )
			return;
		
		//	avoid style changes
		if ( this.VisibleCache === Visible )
			return;
		
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'inherit' : 'hidden';
		this.VisibleCache = Visible;
		if (Visible)
			EnableCssAnimation(this.Element);
	}
}


if ( Pop.GetPlatform() != 'Web' )
{
	function StubHudControl()
	{
		this.SetVisible = function(){};
		this.SetValue = function(){};
		this.SetMinMax = function(){};
	}
	
	Pop.Hud.Slider = StubHudControl;
	Pop.Hud.Button = StubHudControl;
	Pop.Hud.Label = StubHudControl;
}

