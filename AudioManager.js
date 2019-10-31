
//	this needs to evolve into the proper pop API
Pop.Audio = {};


//	https://gist.github.com/wittnl/8a1a0168b94f3b6abfaa#gistcomment-1551393
const SilentMp3Url = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV';

//	gr: on web (mobile explicitly) you cannot play() a Audio unless it's been triggered
//		from a touch/interaction event.
//		once you play() a Audio it is okay'd by the browser, AND you can change the src
//		and play again
//		SO, we keep a pool of allowed-sounds which we will swap around as requested
//		this limits the number of concurrent sounds we can have, but that's probably fine
class SoundPool
{
	constructor(PoolSize=5)
	{
		this.DisabledAudios = [];
		this.UsedAudios = [];
		this.FreeAudios = [];
		for ( let i=0;	i<PoolSize;	i++ )
			this.DisabledAudios.push(null);
		
		
		function OnClick(Event)
		{
			Pop.Debug("CLICKED",this);
			//this.AllocAudios();
		}

		window.addEventListener('touchstart', this.AllocAudios.bind(this), true );
		//document.addEventListener('click', OnClick.bind('document click true'), true);
		//document.addEventListener('click', OnClick.bind('document click false'), false);
		window.addEventListener('click', this.AllocAudios.bind(this), true );
		//document.body.addEventListener('click', OnClick.bind('document.body click true'), true);
		//document.body.addEventListener('mouseup', OnClick.bind('document.body mouseup true'), true);
	}
	
	OnSoundEnabled(Sound)
	{
		//	this sound is now usable
		//	move to free
		Pop.Debug("OnSoundEnabled",...arguments);
		Pop.Array.MoveElementFromArrayToArray( Sound, this.DisabledAudios, this.FreeAudios );
	}
	
	OnSoundError(Sound,Error)
	{
		//	this sound cannot be played
		//	make sure this is in the disabled list
		Pop.Debug("OnSoundError",Sound,Error);
	}
	
	AllocAudios()
	{
		Pop.Debug("Alloc Audios");
		const Pool = this;
		function AllocSound(ExistingSound)
		{
			//	here we COULD check if a sound has not been enabled and then play() to allow it to be used
			if ( ExistingSound != null )
				return ExistingSound;
			
			//	do an intial play to enable
			const Sound = new Audio();
			Sound.src = SilentMp3Url;
			function OnSoundPlay()
			{
				Pool.OnSoundEnabled( Sound );
			}
			function OnSoundError(Error)
			{
				Pool.OnSoundError( Sound, Error );
			}
			Sound.play().then( OnSoundPlay ).catch( OnSoundError );
			
			//	make a free function which puts the sound back in the pool
			Sound.Free = function(){	Pool.Release(Sound);	};
			return Sound;
		}

		this.DisabledAudios = this.DisabledAudios.map( AllocSound );
		this.FreeAudios = this.FreeAudios.map( AllocSound );
		this.UsedAudios = this.UsedAudios.map( AllocSound );

		//window.removeEventListener('touchstart', this.AllocAudios );
		//window.removeEventListener('click', this.AllocAudios );
	}
	
	Pop()
	{
		Pop.Debug("Pop sound from pool");
		if ( this.FreeAudios.length == 0 )
			throw "No availible sounds in sound pool!";
		
		const Sound = this.FreeAudios.splice(0,1)[0];
		this.UsedAudios.push( Sound );
		return Sound;
	}
	
	Release(Sound)
	{
		Pop.Debug("Release sound into pool");
		
		//	stop it playing
		//	https://stackoverflow.com/a/28060352/355753
		//	may need to check its loaded first...
		Sound.pause();
		Sound.src = "";
		Sound.load();
		
		//	find in list
		Pop.Array.MoveElementFromArrayToArray( Sound, this.UsedAudios, this.FreeAudios );
	}
}
Pop.Audio.SoundPool = new SoundPool();



Pop.Audio.AllocSound = function()
{
	if ( Pop.GetExeArguments().includes('NoAudio') )
	{
		const Sound = new AudioFake();
		return Sound;
	}

	//	pop a sound out of the pool
	const Sound = Pop.Audio.SoundPool.Pop();
	return Sound;
}









//	fake audio stub
let AudioFake = function()
{
	this.addEventListener = function(){}
	this.play = function(){}
	this.pause = function(){};
	this.load = function(){};
	this.Free = function(){};
}

if ( Pop.GetPlatform() != 'Web' )
{
	Audio = AudioFake;
}

//	make these params an object?
//	note: this is a player, not an asset
Pop.Audio.Sound = function(Filename,Loop=false)
{
	this.Filename = Filename;
	this.AudioPlayer = null;
	this.PlayPromise = null;	//	non-null if still waiting

	
	this.SetVolume = function(Volume)
	{
		this.AudioPlayer.volume = Volume;
		
		//	check is playing
		if ( !this.AudioPlayer.paused )
			return;
		//	audio has stopped (paused will be true)
		if ( this.AudioPlayer.ended )
		{
			if ( !Loop )
				return;
		}
		
		//	already tried to start
		if ( this.PlayPromise )
		{
			Pop.Debug(Filename,"Audio still waiting for promise");
			return;
		}

		let OnPlaying = function(Event)
		{
			Pop.Debug(Filename,"Now playing",Event);
			this.PlayPromise = null;
		}
		let OnErrorPlaying = function(Error)
		{
			Pop.Debug(Filename,"Error playing",Error);
			this.PlayPromise = null;
		}
		
		this.PlayPromise = this.AudioPlayer.play();
		this.PlayPromise.then( OnPlaying.bind(this) ).catch( OnErrorPlaying.bind(this) );
	}
	
	this.Create = function()
	{
		this.AudioPlayer = Pop.Audio.AllocSound();
		
		this.AudioPlayer.src = Filename;
		this.AudioPlayer.loop = Loop;
		this.AudioPlayer.autoplay = true;
		
		//	callback when meta loaded, should use this for async init/load
		const OnLoaded = function(Event)
		{
			Pop.Debug("Audio on loaded",Event,"Volume is " + this.AudioPlayer.volume, this.AudioPlayer );
			//	gr: this will be initially paused if user has to interact with webpage first
			if ( this.AudioPlayer.paused )
				Pop.Debug("Audio has loaded, initially paused",this);
			
		}		
		const OnError = function(Error)
		{
			Pop.Debug("On error: ",Error);
		}
		this.AudioPlayer.onerror = OnError.bind(this);
		this.AudioPlayer.addEventListener('loadeddata', OnLoaded.bind(this) );
	}
	
	this.Destroy = function()
	{
		if ( !this.AudioPlayer )
			return;

		this.AudioPlayer.Free();
		this.AudioPlayer = null;
	}
	
	//	maybe call this enable?
	this.Play = function(Play=true)
	{
		if ( Play )
			this.AudioPlayer.play();
		else
			this.AudioPlayer.pause();
	}
	
	this.Create();
}


const TQueuedAudio = function(Filename,Loop,StartQuiet,GetVolume)
{
	//	fades are 0..1. null if not yet invoked
	this.Filename = Filename;
	this.FadeInElapsed = StartQuiet ? 0 : 1;
	this.FadeOutElapsed = null;
	this.Audio = null;
	
	this.IsActive = function()
	{
		//	we've deleted it (fade etc)
		if ( !this.Audio )
			return false;
		//	audio has finished
		if ( !this.Audio.IsActive() )
			return false;
		return true;
	}
	
	this.GetVolume = function()
	{
		let FadeInVolume = this.FadeInElapsed;
		let FadeOutVolume = (this.FadeOutElapsed===null) ? 1 : 1 - this.FadeOutElapsed;
		let Volume = FadeInVolume * FadeOutVolume;
		Volume *= GetVolume();
		return Volume;
	}
	
	this.StartFadeOut = function()
	{
		if ( this.FadeOutElapsed === null )
			this.FadeOutElapsed = 0;
	}
	
	this.Destroy = function()
	{
		if ( !this.Audio )
			return;
		this.Audio.Destroy();
		this.Audio = null;
	}
	
	this.Update = function(FadeStep)
	{
		//	continue fades
		if ( this.FadeInElapsed !== null )
		{
			this.FadeInElapsed = Math.min( 1, this.FadeInElapsed + FadeStep );
		}
		
		if ( this.FadeOutElapsed !== null )
		{
			this.FadeOutElapsed += FadeStep;
			if ( this.FadeOutElapsed > 1 )
			{
				this.FadeOutElapsed = 1;
				this.Destroy();
			}
		}
		
		//	update volume
		if ( this.Audio )
		{
			let Volume = this.GetVolume();
			this.Audio.SetVolume( Volume );
		}
	}
	
	//	init volume
	if ( Filename !== null )
	{
		this.Audio = new Pop.Audio.Sound( Filename, Loop );
		this.Audio.SetVolume( this.GetVolume() );
	}
}

const TAudioManager = function(GetCrossFadeDuration,GetMusicVolume,GetMusic2Volume,GetVoiceVolume,GetSoundVolume)
{
	//	array of TQueuedAudio
	//	the last element in the queue is NOT fading out, every other one is
	this.MusicQueue = [];
	this.Music2Queue = [];
	this.VoiceQueue = [];
	this.Sounds = [];

	this.UpdateAudioQueue = function(Queue,FadeStep)
	{
		//	make sure any item not at the end of the queue is fading off
		for ( let i=0;	i<Queue.length-1;	i++ )
			Queue[i].StartFadeOut();
		
		//	update them all
		for ( let i=0;	i<Queue.length;	i++ )
			Queue[i].Update( FadeStep );
		
		//	remove any dead audio
		for ( let i=Queue.length-1;	i>=0;	i-- )
		{
			if ( !Queue[i].IsActive() )
			{
				Queue[i].Destroy();
				Queue.splice( i, 1 );
			}
		}
	}
	
	this.UpdateSounds = function()
	{
		//	delete dead sounds, but also set volume, which will recreate if error
		const SoundVolume = GetSoundVolume();
		function UpdateSound(Sound)
		{
			Sound.SetVolume( SoundVolume );
		}
		this.Sounds.forEach( UpdateSound );
	}
	
	this.Update = function(Timestep)
	{
		const FadeSecs = GetCrossFadeDuration();
		const FadeStep = Timestep / FadeSecs;
		
		this.UpdateAudioQueue( this.MusicQueue, FadeStep );
		this.UpdateAudioQueue( this.Music2Queue, FadeStep );
		this.UpdateAudioQueue( this.VoiceQueue, FadeStep );
		this.UpdateSounds();
	}
	
	this.SetMusic = function(Filename)
	{
		if ( Filename.length == 0 )
			Filename = null;
		
		//	see if this is at the end of the queue
		if ( this.MusicQueue.length > 0 )
		{
			let Last = this.MusicQueue[this.MusicQueue.length-1];
			if ( Last.Filename == Filename )
				return;
		}
		
		let Loop = true;
		let StartQuiet = false;
		let NewSound = new TQueuedAudio( Filename, Loop, StartQuiet, GetMusicVolume );
		this.MusicQueue.push( NewSound );
	}
	
	this.SetMusic2 = function(Filename)
	{
		if ( Filename.length == 0 )
			Filename = null;
		
		//	see if this is at the end of the queue
		if ( this.Music2Queue.length > 0 )
		{
			let Last = this.Music2Queue[this.Music2Queue.length-1];
			if ( Last.Filename == Filename )
				return;
		}
		
		let Loop = true;
		let StartQuiet = false;
		let NewSound = new TQueuedAudio( Filename, Loop, StartQuiet, GetMusic2Volume );
		this.Music2Queue.push( NewSound );
	}

	this.PlayVoice = function(Filename)
	{
		//	empty string is a blank audio
		if ( !Filename.length )
			Filename = null;
		
		//	see if this is at the end of the queue
		//	gr: change to see if it's in the queue at all?
		if ( this.VoiceQueue.length > 0 )
		{
			let Last = this.VoiceQueue[this.VoiceQueue.length-1];
			if ( Last.Filename == Filename )
				return;
		}
		
		let Loop = false;
		let StartQuiet = false;
		let NewSound = new TQueuedAudio( Filename, Loop, StartQuiet, GetVoiceVolume );
		this.VoiceQueue.push( NewSound );
	}
	

	this.GetQueueDebug = function(Queue)
	{
		if ( Queue.length == 0 )
			return "No audio queued";
		
		let Metas = [];
		let PushMeta = function(AudioQueueItem)
		{
			let Volume = AudioQueueItem.GetVolume() * 100;
			Volume = Volume.toFixed(0);
			let Debug = AudioQueueItem.Filename + "@" + Volume + "%";
			Metas.push( Debug );
		}
		Queue.forEach( PushMeta );
		return Metas.join(", ");
	}
	
	this.GetMusicQueueDebug = function()
	{
		return this.GetQueueDebug(this.MusicQueue);
	}
	
	this.GetMusic2QueueDebug = function()
	{
		return this.GetQueueDebug(this.Music2Queue);
	}

	this.GetVoiceQueueDebug = function()
	{
		return this.GetQueueDebug(this.VoiceQueue);
	}
	
	this.PlaySound = function(Filename)
	{
		const Sound = new Pop.Audio.Sound(Filename);
		this.Sounds.push( Sound );
	}
}
