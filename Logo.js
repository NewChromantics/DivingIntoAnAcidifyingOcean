Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('AssetManager.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');
Pop.Include('PopEngineCommon/PopMath.js');

const LogoParticleFrag = Pop.LoadFileAsString('LogoParticle.frag.glsl');
const LogoParticleVert = Pop.LoadFileAsString('LogoParticle.vert.glsl');


function HideLogo()
{
	let HideHud = function(Name)
	{
		let Div = new Pop.Hud.Label(Name);
		Div.SetVisible(false);
	}

	HideHud('TitleText');
	HideHud('Hint_Start');
	HideHud('Hint_Headphones');
	HideHud('IconHeadphones');
}

function TLogoState()
{
	const ParamsWindowRect = [1000,100,350,200];
	this.Params = {};
	this.Params.LocalScale = 0.094;
	this.Params.WorldScale = 0.210;
	this.Params.DebugPhysicsTextures = true;
	this.LogoParamsWindow = new CreateParamsWindow( this.Params, function(){}, ParamsWindowRect );
	this.LogoParamsWindow.AddParam('LocalScale',0,2);
	this.LogoParamsWindow.AddParam('WorldScale',0,2);
	this.LogoParamsWindow.AddParam('DebugPhysicsTextures',0,2);

	const LogoMeta = {};
	LogoMeta.Filename = 'Logo.dae.json';
	LogoMeta.Position = [0,0,0];
	LogoMeta.Scale = 0.9;
	LogoMeta.TriangleScale = 0.03;
	LogoMeta.Colours = [ [1,1,1] ];
	LogoMeta.VertexSkip = 0;
	
	this.LogoActor = new TPhysicsActor(LogoMeta);
	this.PreloadPromises = [];
	this.PreloadPromisesFinished = false;
	this.StartButton = null;
	this.StartButtonPressed = false;
	this.PreloadFilenames =
	[
		'Timeline.json',
		'CameraSpline.dae.json',
		'Shell/shellFromBlender.obj',
		'Quad.vert.glsl',
		'ParticleTriangles.vert.glsl',
		'ParticleColour.frag.glsl',
		'BlitCopy.frag.glsl',
		'Geo.vert.glsl',
		'Colour.frag.glsl',
		'Edge.frag.glsl',
		'PhysicsIteration_UpdateVelocity.frag.glsl',
		'PhysicsIteration_UpdatePosition.frag.glsl',

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
		'PopEngineCommon/PopTexture.js',
		'Noise0.png',
	 	null
	];
	
	function PreloadOceanFilenames()
	{
		let LoadOceanFrames = 96;
		if ( Pop.GetExeArguments().includes('ShortOcean') )
			LoadOceanFrames = 4;
		for ( let i=1;	i<=LoadOceanFrames;	i++ )
		{
			let Filename = 'Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply.mesh.json';
			this.PreloadFilenames.push(Filename);
		}
	}
	PreloadOceanFilenames.call(this);
	
	
	
	
	const Load = function(Filename)
	{
		if ( !Filename )
			return;
		const Promise = Pop.AsyncCacheAssetAsString(Filename);
		this.PreloadPromises.push( Promise );
	}
	this.PreloadFilenames.forEach( Load.bind(this) );
	
	const OnPreloadFinished = function()
	{
		this.PreloadPromisesFinished = true;
	}
	Promise.all( this.PreloadPromises ).then( OnPreloadFinished.bind(this) );
	
	
	this.Update = function()
	{
		//	show button when preloads done
		if ( this.PreloadPromisesFinished )
		{
			if ( !this.StartButton )
			{
				let OnClicked = function()
				{
					this.StartButtonPressed = true;
				}
				this.StartButton = new Pop.Hud.Button('Hint_Start');
				this.StartButton.OnClicked = OnClicked.bind(this);
				this.StartButton.SetVisible(true);
			}
		}
	}
}

let LogoState = null;

function Update_Logo(FirstUpdate,UpdateDuration,StateTime)
{
	//	setup preloads
	if ( FirstUpdate )
	{
		LogoState = new TLogoState();
		LoadLogoScene();
	}
	
	
	LogoState.Update();
	
	
	//	wait minimum of X secs
	//	todo: and button press
	if ( StateTime < 3 )
	{
		//Pop.Debug("Logo...",StateTime);
		return;
	}
	
	//	wait for preloads
	if ( !LogoState.PreloadPromisesFinished )
	{
		Pop.Debug("Waiting for preloads...");
		return;
	}
	
	//	wait for button to be pressed
	if ( !LogoState.StartButtonPressed )
		return;
	
	HideLogo();
	return 'Experience';
}


function Update_Experience(FirstUpdate)
{
	if ( FirstUpdate )
	{
		let Source = Pop.LoadFileAsString('AcidicOcean.js');
		Pop.CompileAndRun( Source, 'AcidicOcean.js' );
		
		//	show some elements
		let ShowHud = function(Name)
		{
			let Div = new Pop.Hud.Label(Name);
			Div.SetVisible(true);
		}
		const ShowElements =
		[
		 'AudioMusic',
		 'AudioVoice',
		 'SubtitleLabel',
		 'YearSlider',
		 'Timeline',
		 'Year',
		 'Stats',
		// 'Hint_Headphones',
		 'IconHeadphones',
		 'Hint_TapAnimal',
		 'Hint_ClickAnimal',
		 'Hint_DragTimeline_Mobile',
		 'Hint_DragTimeline_Desktop',
		 'Hint_TouchToInteract',
		 'AnimalCard'
		 ];
		ShowElements.forEach( ShowHud );
	}
}


function RenderTriangleBufferActor(RenderTarget,Actor,ActorIndex,SetGlobalUniforms,Time)
{
	const Params = LogoState.Params;
	
	const PositionsTexture = Actor.GetPositionsTexture();
	const VelocitysTexture = Actor.GetVelocitysTexture();
	const BlitShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	const Shader = Pop.GetShader( RenderTarget, LogoParticleFrag, LogoParticleVert );
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];
	
	let SetUniforms = function(Shader)
	{
		SetGlobalUniforms(Shader);
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
		let Quad = GetQuadGeometry(RenderTarget);
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
	const DurationSecs = 1 / 60;
	const Time = 0;
	LogoState.LogoActor.PhysicsIteration( DurationSecs, Time, RenderTarget );
	
	let SetGlobalUniforms = function(Shader)
	{
		Shader.SetUniform('LocalScale',LogoState.Params.LocalScale);
		Shader.SetUniform('WorldScale',LogoState.Params.WorldScale);
	}
	
	RenderTarget.ClearColour(0,1,0);
	RenderTriangleBufferActor( RenderTarget, LogoState.LogoActor, 0, SetGlobalUniforms, Time );
	Pop.Debug("Render logo");
}

function LoadLogoScene()
{
	Window.OnRender = LogoRender;
	Window.OnMouseMove = function(){};
}
