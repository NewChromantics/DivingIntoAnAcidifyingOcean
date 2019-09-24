Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('Actors.js');
Pop.Include('AssetManager.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');
Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('AssetImport.js');
Pop.Include('Animals.js');

const EnableLogoParams = false;
const EnableInteractiveLogo = Pop.GetExeArguments().includes('Logo');

const LogoParticleFrag = Pop.LoadFileAsString('Logo/LogoParticle.frag.glsl');
const LogoParticleVert = Pop.LoadFileAsString('Logo/LogoParticle.vert.glsl');
const LogoParticlePhysicsIteration_UpdateVelocity = Pop.LoadFileAsString('Logo/Logo_PhysicsIteration_UpdateVelocity.frag.glsl');
const LogoParticlePhysicsIteration_UpdatePosition = Pop.LoadFileAsString('Logo/Logo_PhysicsIteration_UpdatePosition.frag.glsl');
const LogoSdfFrag = Pop.LoadFileAsString('Logo/LogoSdf.frag.glsl');


const MinimumLogoSecs = 0.1;

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

function ShowExperienceElements()
{
	let Div = new Pop.Hud.Label('Experience');
	Div.SetVisible(true);
}

function TLogoState()
{
	this.Time = false;
	this.PushPositions = [];
	this.PushPositionCount = 4;
	
	this.OnMouseMove = function(u,v)
	{
		this.PushPositions.push( [u,v] );
		this.PushPositions = this.PushPositions.slice(-this.PushPositionCount);
	}
	
	this.OnParamsChanged = function(AllParams,ChangedParam)
	{
		//	physics re-enabled, reset
		if ( ChangedParam == 'EnablePhysicsIteration' && AllParams['EnablePhysicsIteration'] )
			this.Time = false;
	}
	
	const ParamsWindowRect = [1000,100,350,200];
	this.Params = {};
	this.Params.SdfMin = 0.90;
	this.Params.SpringForce = 0.32;
	this.Params.Damping = 0.25;
	this.Params.NoiseForce = 0.35;
	this.Params.LocalScale = 0.29;
	this.Params.WorldScale = 0.8;
	this.Params.PushRadius = 0.40;
	this.Params.PushForce = 40.00;
	this.Params.PushForceMax = 40.00;
	this.Params.SampleDelta = 0.0069;
	this.Params.SampleWeightSigma = 4;
	this.Params.DebugPhysicsTextures = false;
	this.Params.EnablePhysicsIteration = true;
	if ( EnableLogoParams && IsDebugEnabled() )
	{
		this.LogoParamsWindow = new CreateParamsWindow( this.Params, this.OnParamsChanged.bind(this), ParamsWindowRect );
		this.LogoParamsWindow.AddParam('SdfMin',0,1);
		this.LogoParamsWindow.AddParam('SampleDelta',0,0.01);
		this.LogoParamsWindow.AddParam('SampleWeightSigma',0,5,Math.floor);
		this.LogoParamsWindow.AddParam('SpringForce',0,10);
		this.LogoParamsWindow.AddParam('Damping',0,1);
		this.LogoParamsWindow.AddParam('NoiseForce',0,10);
		this.LogoParamsWindow.AddParam('PushForce',0,50);
		this.LogoParamsWindow.AddParam('PushForceMax',0,50);
		this.LogoParamsWindow.AddParam('PushRadius',0,0.5);
		this.LogoParamsWindow.AddParam('LocalScale',0,2);
		this.LogoParamsWindow.AddParam('WorldScale',0,2);
		this.LogoParamsWindow.AddParam('DebugPhysicsTextures');
		this.LogoParamsWindow.AddParam('EnablePhysicsIteration');
	}
	
	const LogoMeta = {};
	LogoMeta.Filename = 'Logo/Logo.svg.json';
	LogoMeta.Position = [0,0,0];
	LogoMeta.Scale = 0.2;
	LogoMeta.TriangleScale = 0.03;
	LogoMeta.Colours = [ [1,1,1] ];
	LogoMeta.VertexSkip = 0;
	LogoMeta.UpdateVelocityShader = LogoParticlePhysicsIteration_UpdateVelocity;
	LogoMeta.UpdatePositionShader = LogoParticlePhysicsIteration_UpdatePosition;

	
	this.LogoActor = new TPhysicsActor(LogoMeta);
	this.PreloadPromises = [];
	this.StartButton = null;
	this.StartButtonPressed = false;
	this.PreloadFilenames =
	[
		//	assets
		'Timeline.json',
		'Animals.json',
	 
		'Quad.vert.glsl',
		'ParticleTriangles.vert.glsl',
		'BlitCopy.frag.glsl',
		'Geo.vert.glsl',
		'Colour.frag.glsl',
		'Edge.frag.glsl',
		'PhysicsIteration_UpdateVelocity.frag.glsl',
		'PhysicsIteration_UpdatePosition.frag.glsl',
		'PhysicsIteration_UpdateVelocityPulse.frag.glsl',
	 
	 	'AnimalParticle.frag.glsl',
		'AnimalParticle.vert.glsl',
	 	'Noise/TurbulencePerlin.frag.glsl',


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
		'PopEngineCommon/PopTexture.js'
	];
	this.PreloadSceneFilenames =
	[
	 'CameraSpline.dae.json'
	];
	this.PreloadGeoFilenames =
	[
	];

	//	autogen ocean asset filenames
	{
		let LoadOceanFrames = 96;
		if ( Pop.GetExeArguments().includes('ShortOcean') )
			LoadOceanFrames = 4;
		for ( let i=1;	i<=LoadOceanFrames;	i++ )
		{
			let Filename = 'Ocean/ocean_pts.' + (''+i).padStart(4,'0');
			Filename += '.ply';
			this.PreloadGeoFilenames.push(Filename);
		}
	}

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
	this.PreloadFilenames.forEach( Load.bind(this) );
	
	const LoadAsset = function(Filename,Types)
	{
		const AssetFilenames = [];
		Types.forEach( t => AssetFilenames.push( GetCachedFilename(Filename,t) ) );
		AssetFilenames.push(Filename);
		Load.call( this, AssetFilenames );
	}
	this.PreloadGeoFilenames.forEach( f => LoadAsset.call( this, f, ['texturebuffer.png','geometry'] ) );
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
			let OnClicked = function()
			{
				this.StartButtonPressed = true;
			}
			this.StartButton = new Pop.Hud.Button('Hint_Start');
			this.StartButton.OnClicked = OnClicked.bind(this);
		}
		
		//	show button when preloads done
		//	gr: due to above, this may disable itself again
		this.StartButton.SetVisible( AllPreloadsFinished );
	}
}

let LogoState = null;

function Update_Logo(FirstUpdate,UpdateDuration,StateTime)
{
	//	setup preloads
	if ( FirstUpdate )
	{
		LogoState = new TLogoState();

		ShowLogoElements();
		
		if ( EnableInteractiveLogo )
		{
			LoadLogoScene();

			//	hide title as we replace it with our own!
			let Div = new Pop.Hud.Label('TitleText');
			Div.SetVisible(false);
		}
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
	if ( !Pop.GetExeArguments().includes('AutoStart') )
		if ( !LogoState.StartButtonPressed )
			return;
	
	//	wait for preloads
	if ( !LogoState.IsPreloadFinished() )
		return;
	
	HideLogoElements();
	return 'Experience';
}


function Update_Experience(FirstUpdate)
{
	if ( FirstUpdate )
	{
		let Source = Pop.LoadFileAsString('AcidicOcean.js');
		Pop.CompileAndRun( Source, 'AcidicOcean.js' );
		
		ShowExperienceElements();
	}
}


//	copy of the main scene version, but this will change
function LogoRenderTriangleBufferActor(RenderTarget,Actor,ActorIndex,SetGlobalUniforms,Time,Viewport)
{
	const Params = LogoState.Params;
	
	const PositionsTexture = Actor.GetPositionsTexture();
	const PositionOriginalTexture = Actor.GetPositionOrigTexture();
	const VelocitysTexture = Actor.GetVelocitysTexture();
	const BlitShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	const Shader = Pop.GetShader( RenderTarget, LogoParticleFrag, LogoParticleVert );
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];
	
	let SetUniforms = function(Shader)
	{
		SetGlobalUniforms(Shader);
		Shader.SetUniform('ProjectionAspectRatio', Viewport[3]/Viewport[2] );
		Shader.SetUniform('LocalPositions', LocalPositions );
		Shader.SetUniform('WorldPositions',PositionsTexture);
		Shader.SetUniform('WorldPositionsWidth',PositionsTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',PositionsTexture.GetHeight());
	};
	
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
	
	
	if ( Params.DebugPhysicsTextures )
	{
		let w = 0.2;
		let x = ActorIndex * (w * 1.05);
		let Quad = GetAsset('Quad',RenderTarget);
		let SetDebugPositionsUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0, w, 0.25 ] );
			Shader.SetUniform('Texture',PositionsTexture);
		};
		let SetDebugVelocitysUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0.3, w, 0.25 ] );
			Shader.SetUniform('Texture',VelocitysTexture);
		};
		
		if ( PositionsTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugPositionsUniforms );
		if ( VelocitysTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugVelocitysUniforms );
	}
}

function LogoRender(RenderTarget)
{
	const Params = LogoState.Params;
	const DurationSecs = LogoState.Params.EnablePhysicsIteration ? (1 / 60) : 0;
	const UpdatePhysicsUniforms = function(Shader)
	{
		Shader.SetUniform('Time', (LogoState.Time===false) ? -1 : LogoState.Time);
		Shader.SetUniform('SpringForce', Params.SpringForce );
		Shader.SetUniform('Damping', Params.Damping );
		Shader.SetUniform('NoiseForce', Params.NoiseForce );
		Shader.SetUniform('PushRadius', Params.PushRadius / Params.WorldScale);
		Shader.SetUniform('PushPositions', LogoState.PushPositions );
		Shader.SetUniform('PushForce', Params.PushForce / Params.WorldScale);
		Shader.SetUniform('PushForceMax', Params.PushForceMax / Params.WorldScale );
		Shader.SetUniform('WorldScale', Params.WorldScale );
	
		
		//	disable push until we have enough positions
		if ( LogoState.PushPositions.length < LogoState.PushPositionCount )
		{
			Shader.SetUniform('PushForce', 0 );
		}
	}
	LogoState.LogoActor.PhysicsIteration( DurationSecs, LogoState.Time, RenderTarget, UpdatePhysicsUniforms );
	if ( LogoState.Params.EnablePhysicsIteration )
		LogoState.Time += DurationSecs;
					   
	let SetGlobalUniforms = function(Shader)
	{
		Shader.SetUniform('LocalScale',LogoState.Params.LocalScale);
		Shader.SetUniform('WorldScale',LogoState.Params.WorldScale);
	}
	
	const Viewport = RenderTarget.GetRenderTargetRect();

	let RenderSdf = function(RenderTarget)
	{
		RenderTarget.ClearColour(0,0,0);
		if ( RenderTarget.SetBlendModeMax )
			RenderTarget.SetBlendModeMax();
		LogoRenderTriangleBufferActor( RenderTarget, LogoState.LogoActor, 0, SetGlobalUniforms, LogoState.Time, Viewport );
	}
	if ( !LogoState.LogoSdf )
	{
		const SdfSize = 1024;
		LogoState.LogoSdf = new Pop.Image( [SdfSize,SdfSize] );
		LogoState.LogoSdf.SetLinearFilter(true);
	}
	RenderTarget.RenderToRenderTarget( LogoState.LogoSdf, RenderSdf );

	//	draw sdf on screen
	{
		const ProjectionAspectRatio = Viewport[3] / Viewport[2];
		const BlitShader = Pop.GetShader( RenderTarget, LogoSdfFrag, QuadVertShader );
		RenderTarget.ClearColour(0,1,0);
		const Quad = GetAsset('Quad',RenderTarget);
		const SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',LogoState.LogoSdf);
			Shader.SetUniform('SdfMin',LogoState.Params.SdfMin);
			Shader.SetUniform('ProjectionAspectRatio',ProjectionAspectRatio);
			Shader.SetUniform('SampleDelta', LogoState.Params.SampleDelta );
			Shader.SetUniform('SampleWeightSigma',LogoState.Params.SampleWeightSigma);
		};
		RenderTarget.DrawGeometry( Quad, BlitShader, SetUniforms );
	}
}

function LoadLogoScene()
{
	Window.OnRender = LogoRender;
	Window.OnMouseMove = function(x,y,Button)
	{
		//	pixel space to uv
		const WindowRect = Window.GetScreenRect();
		x /= WindowRect[2];
		y /= WindowRect[3];
		
		//	uv to model space
		y = 1 - y;
		x -= 0.5;
		y -= 0.5;
		x *= 2;
		y *= 2;
		//	undo projection (we render stretched, but data is 1:1)
		const ProjectionAspectRatio = WindowRect[3] / WindowRect[2];
		x /= ProjectionAspectRatio;
		x /= LogoState.Params.WorldScale;
		y /= LogoState.Params.WorldScale;
		LogoState.OnMouseMove( x, y );
	}
}
