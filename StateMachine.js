
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
