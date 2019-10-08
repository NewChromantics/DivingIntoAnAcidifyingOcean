Pop.Include = function(Filename)
{
	let Source = Pop.LoadFileAsString(Filename);
	return Pop.CompileAndRun( Source, Filename );
}

//	auto setup global
function SetGlobal()
{
	Pop.Global = this;
	Pop.Debug(Pop.Global);
}
SetGlobal.call(this);



Pop.Include('PopEngineCommon/PopApi.js');
Pop.Include('AssetImport.js');
Pop.Include('Animals.js');
try
{
	Pop.Include('ConvertAssets.js');
}
catch(e)
{
	Pop.Debug("Convert assets error: " + e);
}

function IsDebugEnabled()
{
	const Args = Pop.GetExeArguments();
	const HasDebug = Args.includes('Debug');
	return HasDebug;
}

Pop.Include('Hud.js');
Pop.Include('Logo.js');


if ( !IsDebugEnabled() )
{
	const DebugHud = new Pop.Hud.Label('Debug');
	DebugHud.SetVisible(false);
}

Pop.StateMachine = function(StateMap,InitialState,ErrorState,AutoUpdate=true)
{
	//	void processing jumps
	const MaxFrameDurationMs = 3/60;
	
	//	if no initial state, use first key (is this in declaration order in every engine?)
	InitialState = InitialState || Object.keys(StateMap)[0];
	ErrorState = ErrorState || InitialState;

	this.CurrentState = InitialState;
	this.CurrentStateStartTime = false;		//	when false, it hasnt been called
	this.LastUpdateTime = Pop.GetTimeNowMs();
	
	this.LoopIteration = function(Paused)
	{
		Paused = (Paused === true);
		const Now = Pop.GetTimeNowMs();
		const ElapsedMs = Now - this.LastUpdateTime;
		let NextState = null;
		//try
		{
			//	get state to execute
			const UpdateFuncName = StateMap[this.CurrentState];
			const UpdateFunc = (typeof UpdateFuncName == 'function') ? UpdateFuncName : Pop.Global[UpdateFuncName];
			const FirstUpdate = (this.CurrentStateStartTime===false);
			
			//	if we're paused, we need to discount this from the state time
			//	maybe we need to switch to incrementing state time, but this suffers from drift
			if ( Paused )
			{
				this.CurrentStateStartTime += ElapsedMs;
			}
			const StateTime = FirstUpdate ? 0 : Now - this.CurrentStateStartTime;
			this.LastUpdateTime = Pop.GetTimeNowMs();
			
			const FrameDuration = Math.min( MaxFrameDurationMs, Paused ? 0 : ElapsedMs / 1000 );
			const FrameStateTime = StateTime / 1000;
			
			
			//	do update
			NextState = UpdateFunc( FirstUpdate, FrameDuration, FrameStateTime );
			
			if ( FirstUpdate )
				this.CurrentStateStartTime = Now;
			
			//	change state
			if ( typeof NextState == 'string' )
			{
				this.CurrentState = NextState;
				this.CurrentStateStartTime = false;
			}
			
			return FrameDuration;
		}
		/*
		catch(e)
		{
			Pop.Debug("State Machine Update error in " + this.CurrentState + ": "+ e);
			this.CurrentState = ErrorState;
			this.CurrentStateTime = false;
			//	re throw errors for now
			throw e;
		}
		*/
	}
	
	this.LoopAsync = async function()
	{
		while ( true )
		{
			await Pop.Yield( 1000/60 );
			this.LoopIteration();
		}
	}
	
	this.LoopAnimation = function()
	{
		if ( !Pop.Global.requestAnimationFrame )
			throw "requestAnimationFrame not supported";
		let Update = function()
		{
			this.LoopIteration();
			Pop.Global.requestAnimationFrame( Update );
		}.bind(this);
		Pop.Global.requestAnimationFrame( Update );
	}
	
	this.OnStateMachineFinished = function()
	{
		Pop.Debug('OnStateMachineFinished');
	}
	
	this.OnStateMachineError = function(Error)
	{
		Pop.Debug('OnStateMachineError',Error);
	}

	
	if ( AutoUpdate && !Pop.Global.requestAnimationFrame )
		AutoUpdate = 'Async';
	
	if ( AutoUpdate == 'Async' )
	{
		this.LoopAsync().then( this.OnStateMachineFinished ).catch( this.OnStateMachineError );
	}
	else if ( AutoUpdate )
	{
		this.LoopAnimation();
	}
}

//	use a string if function not yet declared
let StateMap =
{
	'Logo':	'Update_Logo',
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

Pop.Include('PopEngineCommon/PopFrameCounter.js');

//	window now shared from bootup
const Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.RenderFrameCounter = new Pop.FrameCounter();

Window.OnRender = BootupRender;
Window.OnKeyDown = OnKeyPress;


const BoldMode = Pop.GetExeArguments().includes('Bold');

//	global params...
const Params = {};
Params.EnablePhysicsIteration = true;
Params.XrMode = false;
Params.ScrollFlySpeed = 1;
Params.AnimalDebugParticleColour = false;
//Params.FogColour = [1,0,0];
Params.AnimalBufferLod = 1;
Params.DrawBoundingBoxes = false;
Params.DrawBoundingBoxesFilled = false;
Params.DrawHighlightedActors = false;

Params.FogColour = [0,0,0.2];
Params.FogMinDistance = 8.0;
Params.FogMaxDistance = BoldMode ? 999 : 20.0;

Params.BigBang_Damping = 0.01;
Params.BigBang_NoiseScale = 0.01;
Params.BigBang_TinyNoiseScale = 0.5;

Params.Animal_TriangleScale = 0.01;
Params.Animal_PhysicsDamping = 0.12;
Params.Animal_PhysicsNoiseScale = 16.0;
Params.AnimalScale = 1.0;
Params.AnimalFlip = false;

Params.NastyAnimal_PhysicsNoiseScale = 0.45;
Params.NastyAnimal_PhysicsSpringScale = 0.65;
Params.NastyAnimal_PhysicsDamping = 0.01;
Params.NastyAnimal_PhysicsExplodeScale = 3.1;

Params.Debris_TriangleScale = BoldMode ? 0.09 : 0.025;
Params.Debris_PhysicsDamping = 0.04;
Params.Debris_PhysicsNoiseScale = 9.9;
Params.ShiftDustParticles = false;
Params.DustParticles_BoundsX = 4;
Params.DustParticles_BoundsY = 2;
Params.DustParticles_BoundsZ = 7.4;
Params.DustParticles_OffsetZ = 2.8;



Params.Ocean_TriangleScale = BoldMode ? 0.2 : 0.0148;
Params.OceanAnimationFrameRate = 25;

Params.Turbulence_Frequency = 4.0;
Params.Turbulence_Amplitude = 1.0;
Params.Turbulence_Lacunarity = 0.10;
Params.Turbulence_Persistence = 0.20;
Params.Turbulence_TimeScalar = 0.14;

Params.XrInvertRotation = true;
Params.XrTrackTimelineCamera = true;
Params.DebugCameraClearColour = false;


Params.InitParamsWindow = function(ParamsWindow)
{
	ParamsWindow.AddParam('ScrollFlySpeed',1,300);
	ParamsWindow.AddParam('XrInvertRotation');
	ParamsWindow.AddParam('XrTrackTimelineCamera');
	ParamsWindow.AddParam('DebugCameraClearColour');
	ParamsWindow.AddParam('DrawBoundingBoxes');
	ParamsWindow.AddParam('DrawBoundingBoxesFilled');

	ParamsWindow.AddParam('FogColour','Colour');
	ParamsWindow.AddParam('FogMinDistance',0,50);
	ParamsWindow.AddParam('FogMaxDistance',0,50);

	ParamsWindow.AddParam('AnimalBufferLod',0,1);
	ParamsWindow.AddParam('AnimalScale',0,2);
	ParamsWindow.AddParam('AnimalFlip');
	ParamsWindow.AddParam('AnimalDebugParticleColour');
	ParamsWindow.AddParam('Animal_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('Animal_PhysicsDamping',0,1);
	ParamsWindow.AddParam('Animal_PhysicsNoiseScale',0,20);

	ParamsWindow.AddParam('NastyAnimal_PhysicsNoiseScale',0,10);
	ParamsWindow.AddParam('NastyAnimal_PhysicsSpringScale',0,1);
	ParamsWindow.AddParam('NastyAnimal_PhysicsExplodeScale',0,10);
	ParamsWindow.AddParam('NastyAnimal_PhysicsDamping',0,1);
	
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

	ParamsWindow.AddParam('Turbulence_Frequency',0,20);
	ParamsWindow.AddParam('Turbulence_Amplitude',0,4);
	ParamsWindow.AddParam('Turbulence_Lacunarity',0,4);
	ParamsWindow.AddParam('Turbulence_Persistence',0,4);
	ParamsWindow.AddParam('Turbulence_TimeScalar',0,10);

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

