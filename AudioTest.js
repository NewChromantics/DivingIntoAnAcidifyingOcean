Pop.Include = function (Filename)
{
	let Source = Pop.LoadFileAsString(Filename);
	const Result = Pop.CompileAndRun(Source,Filename);
}


Pop.Include('AudioManager.js');
Pop.Include('Hud.js');

function HideUi()
{
	const Logo = new Pop.Hud.Label('Hud');
	Logo.SetVisible(false);
}
HideUi();


//	setup some test stuff for audio
function ShowText(Text)
{
	const Element = document.getElementById('Ui');
	Element.innerText = Text;
}



function RequestLoop()
{
	function It()
	{
		Iteration(...arguments);
		RequestLoop();
	}
	window.requestAnimationFrame(It);
}
RequestLoop();




class AudioMan
{
	constructor()
	{
		this.Sounds = [];
		this.AsyncUpdate().then(Pop.Debug).catch(Pop.Debug);
	}

	async AsyncUpdate()
	{
		while (true)
		{
			await Pop.WebApi.WaitForForegroundChange();
			this.Sounds.forEach(s => s.OnStateChanged());
		}
	}

	GetDebugState()
	{
		let State = '';
		function AppendSoundState(Sound)
		{
			State += Sound.Url + ': ';
			State += Sound.GetSoundState();
			State += '\n';
		}
		this.Sounds.forEach(AppendSoundState);
		return State;
	}

	AllocSound(Url,Loop)
	{
		const NewSound = new AudioSound(Url,Loop);
		this.Sounds.push(NewSound);
		return NewSound;
	}
}


function GetMusicVolume()
{
	return 1;
}
function GetSoundVolume()
{
	return 1;
}
function GetCrossFadeDuration()
{
	return 0.1;
}

const Aud2 = new TAudioManager(GetCrossFadeDuration,GetMusicVolume,GetMusicVolume,GetSoundVolume,GetSoundVolume);


/*
const AudioManager = new AudioMan();

const Nightingales = AudioManager.AllocSound('Audio/Nightingales.mp3',false);
const SonicRing = AudioManager.AllocSound('Audio/SonicRing.mp3',false);

SonicRing.SetState('Play');
setTimeout(function ()
{
	Nightingales.SetState('Play');
},2000);
*/
function Iteration(Time)
{
	//let State = '\n\n\n\n\n' + AudioManager.GetDebugState();

//	ShowText(State);

	//Aud2.SetMusic('Audio/SonicRing.mp3');
	Aud2.SetMusic('Audio/Nightingales.mp3');

	Aud2.Update( 1/60 );
}


function OnClick()
{
	Aud2.PlaySound('Audio/SonicRing.mp3');
}
window.addEventListener('click',OnClick,true);


