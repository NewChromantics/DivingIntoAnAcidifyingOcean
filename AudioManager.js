
//	this needs to evolve into the proper pop API
Pop.Audio = {};

//	fake audio stub
let AudioFake = function()
{
	this.addEventListener = function(){}
	this.play = function(){}
	this.pause = function(){};
	this.load = function(){};
}

//	make these params an object?
//	note: this is a player, not an asset
Pop.Audio.Sound = function(Filename,Loop=false,AutoPlay=true)
{
	this.Filename = Filename;
	this.AudioPlayer = null;
	this.StartedPlaying = false;	//	to detect browser rejection we keep track if we're still trying to play
	
	this.OnStartedPlaying = function()
	{
		this.StartedPlaying = true;
	}
	
	this.OnDidntPlay = function(Error)
	{
		Pop.Debug("play rejected",Error);
	}
	
	this.SetVolume = function(Volume)
	{
		this.AudioPlayer.volume = Volume;
		
		//	attempt to play
		if ( !this.StartedPlaying && AutoPlay )
		{
			Pop.Debug("trying to play audio");
			try
			{
				let PlayPromise = this.AudioPlayer.play();
				Pop.Debug("typeof PlayPromise", typeof PlayPromise );
				if ( PlayPromise )
				{
					PlayPromise.then( this.OnStartedPlaying.bind(this) ).catch( this.OnDidntPlay.bind(this) );
				}
				else
				{
					this.OnStartedPlaying();
				}
			}
			catch(e)
			{
				this.OnDidntPlay(e);
			}
		}
	}
	
	this.Create = function()
	{
		//this.AudioPlayer = new Audio(Filename);
		this.AudioPlayer = new AudioFake();
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
		//	https://stackoverflow.com/a/28060352/355753
		//	may need to check its loaded first...
		this.AudioPlayer.pause();
		this.AudioPlayer.src = "";
		this.AudioPlayer.load();
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


const TQueuedAudio = function(Filename,Loop=false,AutoPlay=true)
{
	//	fades are 0..1. null if not yet invoked
	this.Filename = Filename;
	this.FadeInElapsed = 0;
	this.FadeOutElapsed = null;
	this.Audio = null;
	
	this.IsActive = function()
	{
		return (this.Audio != null);
	}
	
	this.GetVolume = function()
	{
		let FadeInVolume = this.FadeInElapsed;
		let FadeOutVolume = (this.FadeOutElapsed===null) ? 1 : 1 - this.FadeOutElapsed;
		return FadeInVolume * FadeOutVolume;
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
	this.Audio = new Pop.Audio.Sound( Filename, Loop, AutoPlay );
	this.Audio.SetVolume( this.GetVolume() );
}

const TAudioManager = function(GetCrossFadeDuration)
{
	//	array of TQueuedAudio
	//	the last element in the queue is NOT fading out, every other one is
	this.MusicQueue = [];

	this.Update = function(Timestep)
	{
		//	make sure any item not at the end of the queue is fading off
		for ( let i=0;	i<this.MusicQueue.length-1;	i++ )
			this.MusicQueue[i].StartFadeOut();
		
		const FadeSecs = GetCrossFadeDuration();
		const FadeStep = Timestep / FadeSecs;
		
		//	update them all
		for ( let i=0;	i<this.MusicQueue.length;	i++ )
			this.MusicQueue[i].Update( FadeStep );
		
		//	remove any dead audio
		for ( let i=this.MusicQueue.length-1;	i>=0;	i-- )
		{
			if ( !this.MusicQueue[i].IsActive() )
			{
				this.MusicQueue[i].Destroy();
				this.MusicQueue.splice( i, 1 );
			}
		}
	}
	
	this.SetMusic = function(Filename)
	{
		//	see if this is at the end of the queue
		if ( this.MusicQueue.length > 0 )
		{
			let Last = this.MusicQueue[this.MusicQueue.length-1];
			if ( Last.Filename == Filename )
				return;
		}
		
		let NewSound = new TQueuedAudio( Filename );
		this.MusicQueue.push( NewSound );
	}
	
	
	this.GetMusicQueueDebug = function()
	{
		if ( this.MusicQueue.length == 0 )
			return "No music queued";
		
		let Metas = [];
		let PushMeta = function(AudioQueueItem)
		{
			let Volume = AudioQueueItem.GetVolume() * 100;
			Volume = Volume.toFixed(0);
			let Debug = AudioQueueItem.Filename + "@" + Volume + "%";
			Metas.push( Debug );
		}
		this.MusicQueue.forEach( PushMeta );
		return Metas.join(", ");
	}
}
