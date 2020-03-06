Pop.Debug("Booting up");

//	this isn't always a problem, but saves some CPU time
const IncludedFiles = {};
Pop.Include = function (Filename)
{
	if (IncludedFiles.hasOwnProperty(Filename))
		return;
	let Source = Pop.LoadFileAsString(Filename);
	const Result = Pop.CompileAndRun(Source,Filename);
	IncludedFiles[Filename] = true;
	//	result never used?
	return Result;
}

//	auto setup global, used to find global functions, but the global on web is different to native
function SetGlobal()
{
	Pop.Global = this;
	Pop.Debug(Pop.Global);
}
SetGlobal.call(this);

const RandomNumberCache = [];

function GetRandomNumberArray(Count)
{
	if (RandomNumberCache.length < Count)
		Pop.Debug("calculating random numbers x" + Count);
	while (RandomNumberCache.length < Count)
	{
		RandomNumberCache.push(Math.random());
	}
	return RandomNumberCache;
}


Pop.Include('PopEngineCommon/PopApi.js');
if (!Pop.StateMachine)
	Pop.Include('StateMachine.js');

//	gr: this is currently early otherwise we don't register window click early enough
Pop.Include('AudioManager.js');
Pop.Include('AssetImport.js');
Pop.Include('Water.js');
Pop.Include('AssetManager.js');
Pop.Include('Actors.js');
Pop.Include('ParticleActor.js');
Pop.Include('Hud.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('Scene.js');
Pop.Include('LogoScene.js');
Pop.Include('PopEngineCommon/PopFrameCounter.js');


//	debug, make desktop act like mobile
if (Pop.GetExeArguments().includes('NoFloatTarget'))
{
	Pop.Opengl.CanRenderToFloat = false;
}




function IsDebugEnabled()
{
	const Args = Pop.GetExeArguments();
	const HasDebug = Args.includes('Debug');
	return HasDebug;
}

if ( IsDebugEnabled() )
{
	try
	{
		Pop.Include('ConvertAssets.js');
	}
	catch(e)
	{
		Pop.Debug("Convert assets error: " + e);
	}
}



if ( !IsDebugEnabled() )
{
	const DebugHud = new Pop.Hud.Label('Debug');
	DebugHud.SetVisible(false);
}


//	use a string if function not yet declared
let StateMap =
{
	'LogoScene': 'Update_LogoScene',
	'LoadExperience': 'Update_LoadExperience',
	'Experience': 'Update_Experience',
	'Editor': 'Update_Editor',
	'AssetServer': Update_AssetServer
};

let StateMachine = new Pop.StateMachine( StateMap );

function BootupRender(RenderTarget)
{
	RenderTarget.ClearColour(0,0,0);
}

function OnKeyPress(Key)
{
	if ( Key == 'l' )
	{
		Window.TestLoseContext();
		return true;
	}
}

//	window now shared from bootup
const Window = new Pop.Opengl.Window("The Acidifying Ocean");
Window.RenderFrameCounter = new Pop.FrameCounter();

Window.OnRender = BootupRender;
Window.OnKeyDown = OnKeyPress;
Window.OnMouseMove = function () { };

function SetupFullscreen()
{
	function OnToggleFullscreen()
	{
		const IsFullscreen = Window.IsFullscreen();
		Window.SetFullscreen(!IsFullscreen);
	}
	
	Window.FullscreenButton = new Pop.Hud.Button('FullscreenButton');
	//	disable button if not supported
	Window.FullscreenButton.SetVisible( Window.IsFullscreenSupported() );
	Window.FullscreenButton.OnClicked = OnToggleFullscreen;
}
SetupFullscreen();


const BoldMode = Pop.GetExeArguments().includes('Bold');

//	global params...
const Params = {};
Params.YearsPerSecond = 1;
Params.LogoSwirl_StartPositionX = 0;
Params.LogoSwirl_StartPositionY = 0.2;
Params.LogoSwirl_StartPositionZ = -1;
Params.EnablePhysicsIteration = true;
Params.XrMode = false;
Params.ScrollFlySpeed = 1;
Params.AnimalDebugParticleColour = false;
//Params.FogColour = [1,0,0];
Params.AnimalBufferLod = 1;
Params.DrawBoundingBoxes = IsDebugEnabled();
Params.DrawBoundingBoxesFilled = false;
Params.DrawHighlightedActors = false;
Params.MaxHighlightDistance = 6.5;
Params.LoadTextureBufferNoise = 0.007;
Params.TestRayDistance = 0.82;
Params.DebugPhysicsTextures = false;
Params.DebugNoiseTextures = IsDebugEnabled();
Params.DebugTextureAlpha = false;

Params.FogColour = IsDebugEnabled() ? [0,0,1] : [0,0,0];
Params.FogMinDistance = 8.0;
Params.FogMaxDistance = BoldMode ? 999 : 10.0;

Params.BigBang_Damping = 0.01;
Params.BigBang_NoiseScale = 0.01;
Params.BigBang_TinyNoiseScale = 0.5;

Params.Animal_TriangleScale = 0.01;
Params.Animal_PhysicsDamping = 1;
Params.Animal_PhysicsDamping_End = 0.001;
Params.Animal_PhysicsNoiseScale = 0;
Params.Animal_PhysicsNoiseScale_End = 50.0;
Params.Animal_PhysicsTinyNoiseScale = 0.1;
Params.Animal_PhysicsTinyNoiseScale_End = 10;
Params.Animal_PhysicsDuration = 45;
Params.AnimalScale = 1.0;
Params.AnimalFlip = false;
Params.AnimalPhysicsCullBoundsScale = 2.8;

Params.NastyAnimal_PhysicsNoiseScale = 1.45;
Params.NastyAnimal_PhysicsSpringScale = 0.35;
Params.NastyAnimal_PhysicsDamping = 0.3;
Params.NastyAnimal_PhysicsExplodeScale = 0;
Params.NastyAnimal_TriangleScale = 0.01;
Params.NastyAnimal_TriangleScaleMax = 0.01 * 2.2;
Params.NastyAnimal_TriangleScale_Duration = 1;

Params.Debris_TriangleScale = BoldMode ? 0.09 : 0.025;
Params.Debris_PhysicsDamping = 0.04;
Params.Debris_PhysicsNoiseScale = 9.9;
Params.ShiftDustParticles = false;
Params.DustParticles_BoundsX = 4;
Params.DustParticles_BoundsY = 2;
Params.DustParticles_BoundsZ = 7.4;
Params.DustParticles_OffsetZ = 2.8;

Params.Swirl_TriangleScale = 0.007567000000000001;
Params.Swirl_Physics_SpringScale = 15.0;
Params.Swirl_Physics_MaxSpringForce = 45.3;
Params.Swirl_Physics_Damping = 0.075;
Params.Swirl_Physics_CustomSplineTime = false;
Params.Swirl_Physics_SplineTime = 0.148;
Params.Swirl_Physics_SplineDuration = 5;
Params.Swirl_Physics_SplineTimeRange = 0.061;
Params.Swirl_Physics_SplineStrips = 22;
Params.Swirl_Physics_LocalNoiseScale = 0;
Params.Swirl_Physics_SplineNoiseScale = 0.14;
Params.Swirl_NodeCount = 40;
Params.Swirl_PathLoop = false;
Params.Swirl_PersistentPath = false;	//	for editor
Params.Swirl_PointCount = 3500;
Params.Swirl_LinearTest = false;
Params.Swirl_NodeDistance = 0.70;
Params.Swirl_ShowPathNodePoints = false;
Params.Spline_PointCount = 200;
Params.Spline_LerpToTarget = 0.35;
Params.Spline_ForwardDeviateX = 2.4;
Params.Spline_ForwardDeviateY = 1.5;
Params.Spline_ForwardDeviateZ = 1.2;
Params.Swirl_StartPositionX = 0;
Params.Swirl_StartPositionY = -0.1;
Params.Swirl_StartPositionZ = 0.8;
Params.AlwaysCreateSwirls = false;	//	for debug
Params.CreateSwirlEveryXYears = 7;
Params.Swirl_AvoidRadius = 0.35;
Params.Swirl_AvoidPhysicsScale = 14;

Params.Ocean_TriangleScale = BoldMode ? 0.2 : 0.0148;
Params.OceanAnimationFrameRate = 25;

Params.Turbulence_Frequency = 4.0;
Params.Turbulence_Amplitude = 1.0;
Params.Turbulence_Lacunarity = 0.10;
Params.Turbulence_Persistence = 0.20;
Params.Turbulence_TimeScalar = 0.14;

Params.DoubleBufferPhysics = false;

Params.XrInvertRotation = true;
Params.XrTrackTimelineCamera = true;
Params.DebugCameraClearColour = false;

Params.Water_TimeScale = 1.565;
Params.Water_PosScale = 385;
Params.Water_HeightScale = 0.33;
Params.Water_SidewaysScalar = 0.05;

Params.Wave1_Amplitude = 1.27;
Params.Wave1_Frequency = 0.15;
Params.Wave1_DirX = -0.65;
Params.Wave1_DirZ = -0.54;
Params.Wave1_Phase = 0.71;
Params.Wave1_Sharpness = 0.325;

Params.Wave2_Amplitude = 0.6;
Params.Wave2_Frequency = 0.42;
Params.Wave2_DirX = 0.21;
Params.Wave2_DirZ = 0.7;
Params.Wave2_Phase = 1.4;
Params.Wave2_Sharpness = 2.74;

Params.Wave3_Amplitude = 0.438;
Params.Wave3_Frequency = 1.498;
Params.Wave3_DirX = -0.3;
Params.Wave3_DirZ = -0.112;
Params.Wave3_Phase = 0.868;
Params.Wave3_Sharpness = 1.32;

//	initialised for logo, so make sure it matches timeline's first frame
Params.Ocean_Colour0 = [0.79,0.91,0.95];
Params.Ocean_Colour1 = [0.31,0.70,0.83];
Params.Ocean_Colour2 = [0.17,0.55,0.75];
Params.Ocean_Colour3 = [0.03,0.41,0.67];
Params.Ocean_Colour4 = [0.03,0.25,0.51];
Params.Ocean_Colour5 = [0.03,0.25,0.51];
Params.Ocean_Colour6 = [0.03,0.41,0.67];
Params.Ocean_Colour7 = [0.17,0.55,0.75];
Params.Ocean_Colour8 = [0.31,0.70,0.83];
Params.Ocean_Colour9 = [0.79,0.91,0.95];

Params.Swirl_Colour0 = [1.00,0.00,0.05];
Params.Swirl_Colour1 = [1.00,0.00,0.05];
Params.Swirl_Colour2 = [1.00,0.00,0.05];
Params.Swirl_Colour3 = [1.00,0.00,0.05];
Params.Swirl_Colour4 = [1.00,0.00,0.05];
Params.Swirl_Colour5 = [1.00,0.00,0.05];
Params.Swirl_Colour6 = [1.00,0.00,0.05];
Params.Swirl_Colour7 = [1.00,0.00,0.05];
Params.Swirl_Colour8 = [1.00,0.00,0.05];
Params.Swirl_Colour9 = [1.00,0.00,0.05];

Params.TextSectionYearTimeScale = 0.1;

Params.InitParamsWindow = function(ParamsWindow)
{
	ParamsWindow.AddParam('ScrollFlySpeed',1,300);
	ParamsWindow.AddParam('XrInvertRotation');
	ParamsWindow.AddParam('XrTrackTimelineCamera');
	ParamsWindow.AddParam('DebugCameraClearColour');
	ParamsWindow.AddParam('DrawBoundingBoxes');
	ParamsWindow.AddParam('AnimalPhysicsCullBoundsScale',0.01,4);
	ParamsWindow.AddParam('DrawBoundingBoxesFilled');
	ParamsWindow.AddParam('LoadTextureBufferNoise',0,0.3);
	
	ParamsWindow.AddParam('FogColour','Colour');
	ParamsWindow.AddParam('FogMinDistance',0,50);
	ParamsWindow.AddParam('FogMaxDistance',0,50);

	ParamsWindow.AddParam('AnimalBufferLod',0,1);
	ParamsWindow.AddParam('AnimalScale',0,2);
	ParamsWindow.AddParam('AnimalFlip');
	ParamsWindow.AddParam('AnimalDebugParticleColour');
	ParamsWindow.AddParam('Animal_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('Animal_PhysicsDuration',0,60);
	ParamsWindow.AddParam('Animal_PhysicsDamping',0,1);
	ParamsWindow.AddParam('Animal_PhysicsDamping_End',0,1);
	ParamsWindow.AddParam('Animal_PhysicsNoiseScale',0,50);
	ParamsWindow.AddParam('Animal_PhysicsNoiseScale_End',0,50);
	ParamsWindow.AddParam('Animal_PhysicsTinyNoiseScale',0,10);
	ParamsWindow.AddParam('Animal_PhysicsTinyNoiseScale_End',0,10);

	ParamsWindow.AddParam('NastyAnimal_PhysicsNoiseScale',0,10);
	ParamsWindow.AddParam('NastyAnimal_PhysicsSpringScale',0,1);
	ParamsWindow.AddParam('NastyAnimal_PhysicsExplodeScale',0,10);
	ParamsWindow.AddParam('NastyAnimal_PhysicsDamping',0,1);
	ParamsWindow.AddParam('NastyAnimal_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('NastyAnimal_TriangleScaleMax',0.001,0.2);
	ParamsWindow.AddParam('NastyAnimal_TriangleScale_Duration',0.1,10);

	ParamsWindow.AddParam('BigBang_Damping',0,1);
	ParamsWindow.AddParam('BigBang_NoiseScale',0,5);
	ParamsWindow.AddParam('BigBang_TinyNoiseScale',0,20);
	
	ParamsWindow.AddParam('Debris_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('Debris_PhysicsDamping',0,1);
	ParamsWindow.AddParam('Debris_PhysicsNoiseScale',0,1);
	ParamsWindow.AddParam('ShiftDustParticles');
	ParamsWindow.AddParam('DustParticles_BoundsX',0.01,20);
	ParamsWindow.AddParam('DustParticles_BoundsY',0.01,20);
	ParamsWindow.AddParam('DustParticles_BoundsZ',0.01,20);
	ParamsWindow.AddParam('DustParticles_OffsetZ',-5,5);

	ParamsWindow.AddParam('Ocean_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('OceanAnimationFrameRate',1,60);

	ParamsWindow.AddParam('Swirl_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('Swirl_Physics_SpringScale',0,100);
	ParamsWindow.AddParam('Swirl_Physics_MaxSpringForce',0,100);
	ParamsWindow.AddParam('Swirl_Physics_Damping',0.001,1);
	ParamsWindow.AddParam('Swirl_Physics_CustomSplineTime');
	ParamsWindow.AddParam('Swirl_Physics_SplineTime',0,1);
	ParamsWindow.AddParam('Swirl_Physics_SplineDuration',0,30);
	ParamsWindow.AddParam('Swirl_Physics_SplineStrips',1,100,Math.floor);
	ParamsWindow.AddParam('Swirl_Physics_SplineTimeRange',0,1);
	ParamsWindow.AddParam('Swirl_Physics_LocalNoiseScale',0,2);
	ParamsWindow.AddParam('Swirl_Physics_SplineNoiseScale',0,20);
	ParamsWindow.AddParam('Swirl_NodeCount',4,200,Math.floor);
	ParamsWindow.AddParam('Swirl_PointCount',1,90000,Math.floor);
	ParamsWindow.AddParam('Swirl_PathLoop');
	ParamsWindow.AddParam('Swirl_LinearTest');
	ParamsWindow.AddParam('Swirl_NodeDistance',0.001,2);
	ParamsWindow.AddParam('Swirl_ShowPathNodePoints');

	ParamsWindow.AddParam('Spline_PointCount',1,9000,Math.floor);
	ParamsWindow.AddParam('Spline_LerpToTarget',0,1);
	ParamsWindow.AddParam('Spline_ForwardDeviateX',0,10);
	ParamsWindow.AddParam('Spline_ForwardDeviateY',0,10);
	ParamsWindow.AddParam('Spline_ForwardDeviateZ',0,10);
	ParamsWindow.AddParam('Swirl_StartPositionX',-5,5);
	ParamsWindow.AddParam('Swirl_StartPositionY',-5,5);
	ParamsWindow.AddParam('Swirl_StartPositionZ',-5,5);
	ParamsWindow.AddParam('AlwaysCreateSwirls');
	ParamsWindow.AddParam('CreateSwirlEveryXYears',0,50);
	ParamsWindow.AddParam('Swirl_AvoidRadius',0,20);
	ParamsWindow.AddParam('Swirl_AvoidPhysicsScale',0,20);

	
	ParamsWindow.AddParam('Turbulence_Frequency',0,20);
	ParamsWindow.AddParam('Turbulence_Amplitude',0,4);
	ParamsWindow.AddParam('Turbulence_Lacunarity',0,4);
	ParamsWindow.AddParam('Turbulence_Persistence',0,4);
	ParamsWindow.AddParam('Turbulence_TimeScalar',0,10);

	ParamsWindow.AddParam('DoubleBufferPhysics');
	ParamsWindow.AddParam('DebugNoiseTextures');
	ParamsWindow.AddParam('DebugTextureAlpha');
	ParamsWindow.AddParam('DebugPhysicsTextures');

	
	ParamsWindow.AddParam('Water_TimeScale',0.1,10);
	ParamsWindow.AddParam('Water_PosScale',1,500);
	ParamsWindow.AddParam('Water_HeightScale',0.01,2);
	ParamsWindow.AddParam('Water_SidewaysScalar',0.01,0.4);

	ParamsWindow.AddParam('Wave1_Amplitude',0,2);
	ParamsWindow.AddParam('Wave1_Frequency',0,2);
	ParamsWindow.AddParam('Wave1_DirX',-1,1);
	ParamsWindow.AddParam('Wave1_DirZ',-1,1);
	ParamsWindow.AddParam('Wave1_Phase',0,2);
	ParamsWindow.AddParam('Wave1_Sharpness',0,5);
	
	ParamsWindow.AddParam('Wave2_Amplitude',0,2);
	ParamsWindow.AddParam('Wave2_Frequency',0,2);
	ParamsWindow.AddParam('Wave2_DirX',-1,1);
	ParamsWindow.AddParam('Wave2_DirZ',-1,1);
	ParamsWindow.AddParam('Wave2_Phase',0,2);
	ParamsWindow.AddParam('Wave2_Sharpness',0,5);
	
	ParamsWindow.AddParam('Wave3_Amplitude',0,2);
	ParamsWindow.AddParam('Wave3_Frequency',0,2);
	ParamsWindow.AddParam('Wave3_DirX',-1,1);
	ParamsWindow.AddParam('Wave3_DirZ',-1,1);
	ParamsWindow.AddParam('Wave3_Phase',0,2);
	ParamsWindow.AddParam('Wave3_Sharpness',0,5);
}




let Editor = null;

function Update_Editor(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
		let Source = Pop.LoadFileAsString('Editor.js');
		Pop.CompileAndRun( Source, 'Editor.js' );
		Editor = new TAssetEditor("Hello");
	}
	
	Editor.Update( FrameDuration, StateTime );
}


function Update_AssetServer(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
		Pop.Debug("Running asset server");
	}
}

//	run a webserver on desktop to serve the html version
let HttpServer = null;
if (Pop.GetExeArguments().includes('HttpServer'))
{
	HttpServer = new Pop.Http.Server(8001);
	const Url = 'http://' + HttpServer.GetAddress()[0].Address;
	Pop.ShowWebPage(Url);
}


function RenderScene(Scene,RenderTarget,Camera,Time,GlobalUniforms)
{
	const Viewport = RenderTarget.GetRenderTargetRect();
	const CameraProjectionTransform = Camera.GetProjectionMatrix(Viewport);
	const WorldToCameraTransform = Camera.GetWorldToCameraMatrix();
	const CameraToWorldTransform = Math.MatrixInverse4x4(WorldToCameraTransform);

	GlobalUniforms['WorldToCameraTransform'] = WorldToCameraTransform;
	GlobalUniforms['CameraToWorldTransform'] = CameraToWorldTransform;
	GlobalUniforms['CameraProjectionTransform'] = CameraProjectionTransform;

	function RenderSceneActor(Actor,ActorIndex)
	{
		const SetGlobalUniforms = function (Shader)
		{
			function SetUniforms(Array)
			{
				function SetUniform(Key)
				{
					const Value = Array[Key];
					Shader.SetUniform(Key,Value);
				}
				Object.keys(Array).forEach(SetUniform);
			}
			SetUniforms(GlobalUniforms);
			SetUniforms(Actor.Uniforms);
		}

		//try
		{
			Actor.Render(RenderTarget,ActorIndex,SetGlobalUniforms,Time);
		}
		/*
		 catch(e)
		 {
		 Pop.Debug("Error rendering actor", Actor.Name,e);
		 }
		 */
	}

	Scene.forEach(RenderSceneActor);
}
