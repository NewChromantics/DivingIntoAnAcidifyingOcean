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


try
{
	//Pop.Include('ConvertAssets.js');
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
	'Editor': 'Update_Editor'
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
const Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = BootupRender;
Window.OnKeyDown = OnKeyPress;


const BoldMode = Pop.GetExeArguments().includes('Bold');

//	global params...
const Params = {};
Params.EnablePhysicsIteration = true;
Params.XrMode = false;
Params.ScrollFlySpeed = 10;
Params.AnimalDebugParticleColour = false;
//Params.FogColour = [1,0,0];
Params.AnimalBufferLod = 1;
Params.DrawBoundingBoxes = false;
Params.DrawBoundingBoxesFilled = false;
Params.DrawHighlightedActors = false;

Params.BigBang_Damping = 0.01;
Params.BigBang_NoiseScale = 0.01;
Params.BigBang_TinyNoiseScale = 0.5;

Params.Animal_TriangleScale = 0.01;
Params.Animal_PhysicsDamping = 0.12;
Params.Animal_PhysicsNoiseScale = 16.0;
Params.NastyAnimal_PhysicsNoiseScale = 0.45;
Params.NastyAnimal_PhysicsSpringScale = 0.65;
Params.NastyAnimal_PhysicsDamping = 0.01;
Params.NastyAnimal_PhysicsExplodeScale = 3.1;

Params.Debris_TriangleScale = BoldMode ? 0.09 : 0.025;
Params.Debris_PhysicsDamping = 0.04;
Params.Debris_PhysicsNoiseScale = 9.9;

Params.Turbulence_Frequency = 4.0;
Params.Turbulence_Amplitude = 1.0;
Params.Turbulence_Lacunarity = 0.10;
Params.Turbulence_Persistence = 0.20;
Params.Turbulence_TimeScalar = 0.14;
Params.AnimalScale = 1.0;
Params.AnimalFlip = false;



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


