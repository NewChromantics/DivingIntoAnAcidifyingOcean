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
	//'CrashTest': Update_CrashTest,
	'Logo':	'Update_Logo',
	'Experience': 'Update_Experience'
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

const Params = {};
Params.EnablePhysicsIteration = true;


function TCrashTest()
{
	this.Textures = [];
	this.Debug_Hud = new Pop.Hud.Label('Debug');
	this.Debug_TextureHeap = new Pop.Hud.Label('Debug_TextureHeap');
	
	this.Render = function(RenderTarget)
	{
		const Texture = this.Textures[this.Textures.length-1];
		const Shader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
		const Quad = GetAsset('Quad',RenderTarget);
		
		RenderTarget.ClearColour(0,0,1);
		Pop.Debug("Drawing",Texture);
		const SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture', Texture );
		}
		RenderTarget.DrawGeometry( Quad, Shader, SetUniforms );
	}
}

var CrashTest = null;


const DebugColours =
[
 [1,0,0,1],
 [1,1,0,1],
 [0,1,0,1],
 [0,1,1,1],
 [0,0,1,1],
 [1,0,1,1],
];
let LastDebugColour = 0;
function CreateDebugColourImage(Width,Height)
{
	const Colour = DebugColours[ (LastDebugColour++) % DebugColours.length ];

	let Channels = 4;
	let Format = 'Float4';
		
	let Pixels = new Float32Array( Width * Height * Channels );
	for ( let i=0;	i<Pixels.length;	i+=4 )
	{
		Pixels[i+0] = Colour[0];
		Pixels[i+1] = Colour[1];
		Pixels[i+2] = Colour[2];
		Pixels[i+3] = Colour[3];
	}
		
	let Texture = new Pop.Image();
	Texture.WritePixels( Width, Height, Pixels, Format );
	return Texture;
}

function Update_CrashTest(FirstUpdate,UpdateDuration,StateTime)
{
	if ( FirstUpdate)
	{
		CrashTest = new TCrashTest();
		CrashTest.Debug_Hud.SetVisible(true);
		CrashTest.Debug_TextureHeap.SetVisible(true);
		Window.OnRender = CrashTest.Render.bind(CrashTest);
	}
	
	//	every frame create another big texture
	if ( CrashTest.Textures.length < 1000 )
	{
		const NewTexture = CreateDebugColourImage( 1024, 1024 );
		CrashTest.Textures.push( NewTexture );
	}
	
	//	update hud
	const TextureHeapCount = Window.TextureHeap.AllocCount;
	const TextureHeapSizeMb = Window.TextureHeap.AllocSize / 1024 / 1024;
	CrashTest.Debug_TextureHeap.SetValue("Textures x" + TextureHeapCount + " " + TextureHeapSizeMb.toFixed(2) + "mb" );
}

