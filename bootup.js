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

//	testing anim
/*
Pop.Include('PopEngineCommon/PopCollada.js');

const OnActor = function(Actor)
{
	Pop.Debug(Actor);
}
const OnSpline = function(Actor)
{
	Pop.Debug(Actor);
}
const Contents = Pop.LoadFileAsString('CameraSpline.dae.json');
Pop.Collada.Parse(Contents,OnActor,OnSpline);
*/
 
//Pop.Include('PopEngineCommon/PopShaderCache.js');
//Pop.Include('PopEngineCommon/PopMath.js');
//Pop.Include('PopEngineCommon/PopPly.js');
//Pop.Include('PopEngineCommon/PopObj.js');
//Pop.Include('PopEngineCommon/PopCollada.js');
//Pop.Include('PopEngineCommon/PopTexture.js');
//Pop.Include('PopEngineCommon/PopCamera.js');
//Pop.Include('PopEngineCommon/ParamsWindow.js');

//Pop.Include('AssetManager.js');
//Pop.Include('AudioManager.js');
Pop.Include('Hud.js');

Pop.Include('Logo.js');


if ( !IsDebugEnabled() )
{
	const DebugHud = new Pop.Hud.Label('Debug');
	DebugHud.SetVisible(false);
}

Pop.StateMachine = function(StateMap,InitialState,ErrorState,AutoUpdate=true)
{
	//	if no initial state, use first key (is this in declaration order in every engine?)
	InitialState = InitialState || Object.keys(StateMap)[0];
	ErrorState = ErrorState || InitialState;

	this.CurrentState = InitialState;
	this.CurrentStateStartTime = false;		//	when false, it hasnt been called
	this.LastUpdateTime = Pop.GetTimeNowMs();
	
	this.LoopIteration = function()
	{
		const Now = Pop.GetTimeNowMs();
		const ElapsedMs = Now - this.LastUpdateTime;
		let NextState = null;
		try
		{
			//	get state to execute
			const UpdateFuncName = StateMap[this.CurrentState];
			const UpdateFunc = (typeof UpdateFuncName == 'function') ? UpdateFuncName : Pop.Global[UpdateFuncName];
			const FirstUpdate = (this.CurrentStateStartTime===false);
			const StateTime = FirstUpdate ? 0 : Now - this.CurrentStateStartTime;
			this.LastUpdateTime = Pop.GetTimeNowMs();
			
			//	do update
			NextState = UpdateFunc( FirstUpdate, ElapsedMs / 1000, StateTime / 1000 );
			
			if ( FirstUpdate )
				this.CurrentStateStartTime = Now;
			
			//	change state
			if ( typeof NextState == 'string' )
			{
				this.CurrentState = NextState;
				this.CurrentStateStartTime = false;
			}
		}
		catch(e)
		{
			Pop.Debug("State Machine Update error in " + this.CurrentState + ": "+ e);
			this.CurrentState = ErrorState;
			this.CurrentStateTime = false;
			//	re throw errors for now
			throw e;
		}
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

	if ( AutoUpdate )
	{
		//	async or via animation...
		let AysncUpdate = Pop.GetExeArguments().includes('AysncUpdate');
		if ( !Pop.Global.requestAnimationFrame )
			AysncUpdate = true;
		
		if ( AysncUpdate )
		{
			this.LoopAsync().then( this.OnStateMachineFinished ).catch( this.OnStateMachineError );
		}
		else
		{
			this.LoopAnimation();
		}
	}
}

//	use a string if function not yet declared
let StateMap =
{
	'Logo':	'Update_Logo',
	'Experience': 'Update_Experience'
};

let StateMachine = new Pop.StateMachine( StateMap );

function BootupRender(RenderTarget)
{
	RenderTarget.ClearColour(0,0,1);
}

//	window now shared from bootup
const Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = BootupRender;

const Params = {};
Params.EnablePhysicsIteration = true;

