Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('Animals.js');

const MinimumLogoSecs = 0.01;

function HideLogoElements()
{
	let Div = new Pop.Hud.Label('Logo');
	Div.SetVisible(false);
}

function ShowLogoElements()
{
	let Div = new Pop.Hud.Label('Logo');
	Div.SetVisible(true);
}


function TLogoState()
{
	this.Time = false;
	
	this.PreloadPromises = [];
	this.StartButton = null;
	this.StartButtonPressed = false;
	this.PreloadFilenames =
	[
		//	assets
		'Timeline.json',
	 'TextTimeline1.json',
	 'TextTimeline2.json',
	 'TextTimeline3.json',
		'Animals.json',
	 
		'Quad.vert.glsl',
		'ParticleTriangles.vert.glsl',
		'BlitCopy.frag.glsl',
	 	'BlitCopyMultiple.frag.glsl',
		'Geo.vert.glsl',
		'Colour.frag.glsl',
		'Edge.frag.glsl',
		'PhysicsIteration_UpdateVelocity.frag.glsl',
		'PhysicsIteration_UpdateVelocityPulse.frag.glsl',
	 	'PhysicsIteration_UpdateVelocitySwirl.frag.glsl',
	 	'PhysicsIteration_UpdatePosition.frag.glsl',
	 	'PhysicsIteration_UpdatePositionSwirl.frag.glsl',
	 	'PhysicsIteration_UpdateSwirl.frag.glsl',
	 
	 	'NastyAnimalParticle.frag.glsl',
	 	'NastyAnimalParticle.vert.glsl',
		'AnimalParticle.frag.glsl',
	 	'AnimalParticle.vert.glsl',
		'DustParticle.vert.glsl',
		'WaterParticle.vert.glsl',
	 	'TurbulencePerlin.frag.glsl',

		//	code
	 	'Timeline.js',
		'AcidicOcean.js',
	 	'AssetManager.js',
	 	'AudioManager.js',
		'Hud.js',
		'PopEngineCommon/PopShaderCache.js',
		'PopEngineCommon/PopFrameCounter.js',
		'PopEngineCommon/PopCamera.js',
		'PopEngineCommon/PopMath.js',
		'PopEngineCommon/ParamsWindow.js',
		'PopEngineCommon/PopPly.js',
		'PopEngineCommon/PopObj.js',
		'PopEngineCommon/PopCollada.js',
		'PopEngineCommon/PopCinema4d.js',
		'PopEngineCommon/PopTexture.js'
	];
	this.PreloadSceneFilenames =
	[
	 'CameraSpline.dae.json'
	];
	this.PreloadGeoFilenames =
	[
	];

	//	autogen model asset filenames
	this.PreloadGeoFilenames.push( ...GetAnimalAssetFilenames() );

	function IsImageFilename(Filename)
	{
		return Filename.toLowerCase().endsWith('.png');
	}
	
	function IsValidFilename(Filename)
	{
		if ( !Filename )
			return false;
		if ( Filename.startsWith('.') )
			return false;
		return true;
	}
	
	//	load filenames, preference first
	const Load = function(Filenames)
	{
		if ( !Filenames )
			return;
		if ( !Array.isArray(Filenames) )
			Filenames = [Filenames];
		
		Filenames = Filenames.filter( IsValidFilename );
		if ( Filenames.length == 0 )
			return;
		
		const Filename = Filenames.shift();
		const AsyncCacheFunction = IsImageFilename(Filename) ? Pop.AsyncCacheAssetAsImage : Pop.AsyncCacheAssetAsString;
		//	no need to cache (desktop)
		//	support this maybe?
		if ( !AsyncCacheFunction )
			return;
		
		const LoadBackup = function(Error)
		{
			Pop.Debug("Preload of",Filename,"failed, loading next backup",Filenames);
			Load.call( this, Filenames );
		}.bind(this);

		//	create promise and put in the list
		const Promise = AsyncCacheFunction(Filename);
		Promise.IsSettled = false;
		
		//	track when promise is finished
		const OnLoaded = function()
		{
			Promise.IsSettled = true;
		}
		
		//	track & load backup where appropriate
		const OnFailed = function(Error)
		{
			Promise.IsSettled = true;
			LoadBackup(Error);
		}
		
		Promise.then( OnLoaded ).catch( OnFailed );
		
		this.PreloadPromises.push( Promise );
	}
	
	const LoadFile = function(Filename)
	{
		Load.call( this, Filename );
		if ( MonitorAssetFile )
			MonitorAssetFile( Filename );
	}
	this.PreloadFilenames.forEach( LoadFile.bind(this) );
	
	const LoadAsset = function(Filename,Types)
	{
		const AssetFilenames = [];
		Types.forEach( t => AssetFilenames.push( GetCachedFilename(Filename,t) ) );
		AssetFilenames.push(Filename);
		Load.call( this, AssetFilenames );
		
		if ( MonitorAssetFile )
			AssetFilenames.forEach( MonitorAssetFile );
	}
	//this.PreloadGeoFilenames.forEach( f => LoadAsset.call( this, f, ['texturebuffer.png','geometry'] ) );
	this.PreloadGeoFilenames.forEach( f => LoadAsset.call( this, f, ['texturebuffer.png'] ) );
	this.PreloadSceneFilenames.forEach( f => LoadAsset.call( this, f, ['scene'] ) );

	this.IsPreloadFinished = function()
	{
		let AllFinished = this.PreloadPromises.every( p => p.IsSettled );
		return AllFinished;
	}
	
	this.Update = function()
	{
		//	calling allSettled() and then adding more... prematurely completes
		let AllPreloadsFinished = this.IsPreloadFinished();
		
		if ( !this.StartButton )
		{
			let OnClickedStart = function()
			{
				this.StartButtonPressed = true;
			}
			this.StartButton = new Pop.Hud.Button('Hint_Start');
			this.StartButton.OnClicked = OnClickedStart.bind(this);
		}
		
		//	show button when preloads done
		//	gr: due to above, this may disable itself again
		this.StartButton.SetVisible( AllPreloadsFinished );
	}
}

let LogoState = null;

function Update_LoadExperience(FirstUpdate,UpdateDuration,StateTime)
{
	//	setup preloads
	if ( FirstUpdate )
	{
		LogoState = new TLogoState();

		ShowLogoElements();
	}
	
	
	LogoState.Update();
	
	
	//	wait minimum of X secs
	//	todo: and button press
	if ( StateTime < MinimumLogoSecs )
	{
		//Pop.Debug("Logo...",StateTime);
		return;
	}
	
	//	wait for button to be pressed
	const AssetServerMode = Pop.GetExeArguments().includes('AssetServer');
	const EditorMode = Pop.GetExeArguments().includes('Editor');
	const AutoStart = Pop.GetExeArguments().includes('AutoStart') || AssetServerMode || EditorMode;
	if ( !AutoStart )
		if ( !LogoState.StartButtonPressed )
			return;
	
	//	wait for preloads
	if ( !LogoState.IsPreloadFinished() )
		return;
	
	HideLogoElements();
	
	if ( AssetServerMode )
		return 'AssetServer';
	
	if ( EditorMode )
		return 'Editor';

	return 'Experience';
}


function Update_Experience(FirstUpdate)
{
	if ( FirstUpdate )
	{
		let Source = Pop.LoadFileAsString('AcidicOcean.js');
		Pop.CompileAndRun( Source, 'AcidicOcean.js' );
	}
}

