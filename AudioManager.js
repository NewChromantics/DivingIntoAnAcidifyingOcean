
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
	constructor(PoolSize=8)
	{
		this.DisabledAudios = [];
		this.UsedAudios = [];
		this.FreeAudios = [];
		for ( let i=0;	i<PoolSize;	i++ )
			this.DisabledAudios.push(null);
		
		function OnClick()
		{
			Pop.Debug("ONCLICK", this);
		}
		
		//	debug
		//window.addEventListener('touchstart', OnClick.bind('window touchstart'), true );
		//document.addEventListener('click', OnClick.bind('document click true'), true);
		//document.addEventListener('click', OnClick.bind('document click false'), false);
		//document.body.addEventListener('click', OnClick.bind('document.body click true'), true);
		//document.body.addEventListener('mouseup', OnClick.bind('document.body mouseup true'), true);
		
		//	not a user event!
		//window.addEventListener('touchstart', this.AllocAudios.bind(this), true );

		if (Pop.GetPlatform() == "Web")
		{
			//	desktop & safari on ios
			window.addEventListener('click',this.AllocAudios.bind(this),true);
		}
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
		//	"" triggers an error!
		//Sound.src = "";
		Sound.src = SilentMp3Url;
		Sound.load();
		
		//	find in list
		Pop.Array.MoveElementFromArrayToArray( Sound, this.UsedAudios, this.FreeAudios );
	}
}
Pop.Audio.SoundPool = new SoundPool();
Pop.Audio.SoundIdCounter = 1000;

Pop.Audio.AllocSoundId = function()
{
	return Pop.Audio.SoundIdCounter++;
}

Pop.Audio.AllocSound = function()
{
	if ( Pop.GetExeArguments().includes('NoAudio') )
	{
		const Sound = new AudioFake();
		return Sound;
	}

	try
	{
		//	pop a sound out of the pool
		const Sound = Pop.Audio.SoundPool.Pop();
		return Sound;
	}
	catch(e)
	{
		Pop.Debug("Alloc sound failed: "+ e);
		const Sound = new AudioFake();
		return Sound;
	}
}









//	fake audio stub
let AudioFake = function()
{
	this.addEventListener = function(){};
	this.removeEventListener = function(){};
	this.pause = function(){};
	this.load = function(){};
	this.Free = function(){};
	this.play = function()
	{
		return new Promise( function(Resolve,Reject){	Resolve();	} );
	}
}

if ( Pop.GetPlatform() != 'Web' )
{
	Audio = AudioFake;
}

//	make these params an object?
//	note: this is a player, not an asset
Pop.Audio.Sound = class
{
	constructor(Filename,Loop=false)
	{
		this.Loop = Loop;
		this.Filename = Filename;
		this.PlayPromise = null;	//	non-null if still waiting
		this.AudioPlayer = null;
		
		this.Event_Error = null;
		this.Event_Loaded = null;
		this.Event_Ended = null;
		this.Event_Suspend = null;
		this.Event_Emptied = null;
		this.Create();
	}
	
	SetVolume(Volume)
	{
		//	this can be null if the sound has finished
		if ( !this.AudioPlayer )
			return;
		this.AudioPlayer.volume = Volume;
	}
	
	Create()
	{
		this.Event_Ended = function()
		{
			Pop.Debug("This sound has ended");
			this.Destroy();
		}.bind(this);
		
		this.Event_Suspended = function()
		{
			//	https://www.w3schools.com/jsref/event_onsuspend.asp
			//	This can happen when the download has completed, or because it has been paused for some reason
			Pop.Debug("This sound has been suspended");
			//this.Destroy();
		}.bind(this);
		
		this.Event_Emptied = function()
		{
			Pop.Debug("This sound has been empited");
			//this.Destroy();
		}.bind(this);

		//	callback when meta loaded, should use this for async init/load
		this.Event_Loaded = function(Event)
		{
			Pop.Debug("Audio on loaded",Event,"Volume is " + this.AudioPlayer.volume, this.AudioPlayer );
			//	gr: this will be initially paused if user has to interact with webpage first
			if ( this.AudioPlayer.paused )
				Pop.Debug("Audio has loaded, initially paused",this);
		}.bind(this);
		
		this.Event_Error = function(Error)
		{
			if ( !this.AudioPlayer )
			{
				Pop.Debug("On Error",Error,"with no AudioPlayer");
				return;
			}
			
			Pop.Debug("On Error",Error,"WITH AudioPlayer");
			const ErrorCode = this.AudioPlayer.error;
			this.Destroy();
			/*
			1 = MEDIA_ERR_ABORTED - fetching process aborted by user
			2 = MEDIA_ERR_NETWORK - error occurred when downloading
			3 = MEDIA_ERR_DECODE - error occurred when decoding
			4 = MEDIA_ERR_SRC_NOT_SUPPORTED - audio/video not supported
			 */
		}.bind(this);

		//	need to handle when this fails
		this.AudioPlayer = Pop.Audio.AllocSound();
		this.AudioPlayer.loop = this.Loop;
		this.AudioPlayer.autoplay = true;
		
		//	once would be good, but if it's not triggered it's left over, so we'll still manage it
		//this.AudioPlayer.addEventListener('error', OnError, {once:true,passive:true} );
		//this.AudioPlayer.addEventListener('loadeddata', OnLoaded, {once:true,passive:true}  );
		//this.AudioPlayer.addEventListener('ended', OnEnded, {once:true,passive:true}  );
		this.AudioPlayer.addEventListener('error',this.Event_Error);
		this.AudioPlayer.addEventListener('loadeddata',this.Event_LoadedData);
		this.AudioPlayer.addEventListener('ended',this.Event_Ended);
		this.AudioPlayer.addEventListener('suspend',this.Event_Suspended);
		this.AudioPlayer.addEventListener('emptied',this.Event_Emptied);

		//	this triggers the load & play
		this.AudioPlayer.src = this.Filename;
		
		const OnPlay = function(Args)
		{
			Pop.Debug("Play success",...arguments);
		}.bind(this);
		
		const OnPlayError = function(Error)
		{
			Pop.Debug("Play error",Error,...arguments);
		}.bind(this);
		
		this.AudioPlayer.load();
		this.AudioPlayer.play().then(OnPlay).catch(OnPlayError);
	}
	
	Destroy()
	{
		//	already dead
		if ( !this.AudioPlayer )
			return;

		//	remove events
		this.AudioPlayer.removeEventListener('error',this.Event_Error);
		this.AudioPlayer.removeEventListener('loadeddata',this.Event_LoadedData);
		this.AudioPlayer.removeEventListener('ended',this.Event_Ended);
		this.AudioPlayer.removeEventListener('suspend',this.Event_Suspended);
		this.AudioPlayer.removeEventListener('emptied',this.Event_Emptied);

		const Audio = this.AudioPlayer;
		this.AudioPlayer = null;
		Audio.Free();
	}
	
	IsActive()
	{
		//	we auto delete the audio when it's finished,
		//	so we can just check the player status
		if ( !this.AudioPlayer )
			return false;
		return true;
	}
	
	//	maybe call this enable?
	Play(Play=true)
	{
		Pop.Debug("Audio Play/Pause",Play);
		if ( Play )
			this.AudioPlayer.play();
		else
			this.AudioPlayer.pause();
	}
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
		Sound.Id = Pop.Audio.AllocSoundId();
		this.Sounds.push( Sound );
		Pop.Debug("PlaySound(",Filename);
		return Sound.Id;
	}
	
	this.StopSound = function(SoundId)
	{
		function MatchSound(Sound)
		{
			return Sound.Id == SoundId;
		}
		//	we should queue these and fade out instead of just stopping
		let MatchSounds = this.Sounds.filter( MatchSound );
		this.Sounds = this.Sounds.filter( s => !MatchSound(s) );
		function KillSound(Sound)
		{
			Pop.Debug("Killing sound");
			Sound.Destroy();
		}
		if ( MatchSounds.length == 0 )
			Pop.Debug("Tried to kill sound",SoundId," but no matches");
		MatchSounds.forEach( KillSound );
	}
}
