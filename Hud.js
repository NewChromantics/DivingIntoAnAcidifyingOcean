
//	we should make this as close to Pop.Gui as possible really... and re-use it for web
//	but for now, lets just mess with the DOM
Pop.Hud = {};

//	reference to a label
Pop.Hud.Label = function()
{
	Pop.Gui.Label.apply( this, arguments );

	this.SetVisible = function(Visible)
	{
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'visible' : 'hidden';
	}
}

//	reference to a slider
Pop.Hud.Slider = Pop.Gui.Slider;

//	reference to a button
Pop.Hud.Button = function()
{
	Pop.Gui.Button.apply( this, arguments );
	
	this.SetVisible = function(Visible)
	{
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'visible' : 'hidden';
	}
}

