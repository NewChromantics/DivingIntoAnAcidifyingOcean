
const BlitCopyShader = Pop.LoadFileAsString('BlitCopy.frag.glsl');
const ParticlePhysicsIteration_UpdateVelocity = Pop.LoadFileAsString('PhysicsIteration_UpdateVelocity.frag.glsl');
const ParticlePhysicsIteration_UpdatePosition = Pop.LoadFileAsString('PhysicsIteration_UpdatePosition.frag.glsl');
const QuadVertShader = Pop.LoadFileAsString('Quad.vert.glsl');
const ParticleTrianglesVertShader = Pop.LoadFileAsString('ParticleTriangles.vert.glsl');




function TPhysicsActor(Meta)
{
	this.Position = Meta.Position;
	this.BoundingBox = null;
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Meta = Meta;
	
	if ( !this.Meta.UpdateVelocityShader )
		this.Meta.UpdateVelocityShader = ParticlePhysicsIteration_UpdateVelocity;
	if ( !this.Meta.UpdatePositionShader )
		this.Meta.UpdatePositionShader = ParticlePhysicsIteration_UpdatePosition;
	
	this.IndexMap = null;
	this.GetIndexMap = function(Positions)
	{
		//	generate
		if ( !this.IndexMap )
		{
			//	add index to each position
			let SetIndex = function(Element,Index)
			{
				Element.push(Index);
			}
			Positions.forEach( SetIndex );
			
			//	sort the positions
			let SortPosition = function(a,b)
			{
				if ( a[2] < b[2] )	return -1;
				if ( a[2] > b[2] )	return 1;
				return 0;
			}
			Positions.sort(SortPosition);
			
			//	extract new index map
			this.IndexMap = [];
			Positions.forEach( xyzi => this.IndexMap.push(xyzi[3]) );
		}
		return this.IndexMap;
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
		//	need data initialised
		this.GetTriangleBuffer(RenderTarget);
		
		//Pop.Debug("PhysicsIteration", JSON.stringify(this) );
		//	pause/dont run
		if ( DurationSecs == 0 )
			return;

		PhysicsIteration( RenderTarget, Time, this.PositionTexture, this.VelocityTexture, this.ScratchTexture, this.PositionOrigTexture, this.Meta.UpdateVelocityShader, this.Meta.UpdatePositionShader, SetPhysicsUniforms );
	}
	
	this.ResetPhysicsTextures = function()
	{
		//Pop.Debug("ResetPhysicsTextures", JSON.stringify(this) );
		//	need to init these to zero?
		let Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		this.VelocityTexture = new Pop.Image(Size,'Float3');
		this.ScratchTexture = new Pop.Image(Size,'Float3');
		this.PositionOrigTexture = new Pop.Image();
		this.PositionOrigTexture.Copy( this.PositionTexture );
	}
	
	this.GetPositionsTexture = function()
	{
		return this.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return this.VelocityTexture;
	}
	
	this.GetPositionOrigTexture = function()
	{
		return this.PositionOrigTexture;
	}
	

	this.GetTriangleBuffer = function(RenderTarget)
	{
		if ( this.TriangleBuffer )
			return this.TriangleBuffer;
		
		this.TriangleBuffer = LoadPointMeshFromFile( RenderTarget, Meta.Filename, this.GetIndexMap.bind(this) );
		this.PositionTexture = this.TriangleBuffer.PositionTexture;
		this.ColourTexture = this.TriangleBuffer.ColourTexture;
		this.AlphaTexture = this.TriangleBuffer.AlphaTexture;
		this.BoundingBox = this.TriangleBuffer.BoundingBox;
		this.ResetPhysicsTextures();
		
		return this.TriangleBuffer;
	}
	
	this.GetLocalToWorldTransform = function()
	{
		//Pop.Debug("physics pos", JSON.stringify(this));
		if ( !this.LocalToWorldTransform )
		{
			let Trans = Math.CreateTranslationMatrix( ...this.Position );
			let Scale = Math.CreateScaleMatrix( this.Meta.Scale );
			this.LocalToWorldTransform = Math.MatrixMultiply4x4Multiple( Scale, Trans );
		}
		return this.LocalToWorldTransform;
	}
	
	this.GetBoundingBox = function()
	{
		return this.BoundingBox;
	}
}









function TAnimationBuffer(Filenames,Scale)
{
	this.Frames = null;
	this.BoundingBox = null;
	
	this.Init = function(RenderTarget)
	{
		if ( this.Frames )
			return;
		
		let LoadFrame = function(Filename,Index)
		{
			//	gr: making frame duration dynamic now, so time here is always 1
			let Frame = {};
			Frame.GetTime = function()
			{
				return Index / Params.OceanAnimationFrameRate;
			};

			//	gr: load as many as we can (so we can control which ones are availible at the preload time)
			//	todo: change this so it loads async but on demand so doesn't fall over if stuff is missing
			try
			{
				const GetIndexMap = undefined;
				const TriangleBuffer = LoadPointMeshFromFile( RenderTarget, Filename, GetIndexMap );
				Frame.TriangleBuffer = TriangleBuffer;
				Frame.PositionTexture = TriangleBuffer.PositionTexture;
				Frame.ColourTexture = TriangleBuffer.ColourTexture;
				Frame.AlphaTexture = TriangleBuffer.AlphaTexture;
				
				//	should grab biggest, but lets just overwrite
				this.BoundingBox = TriangleBuffer.BoundingBox;

				this.Frames.push(Frame);
			}
			catch(e)
			{
				Pop.Debug("Ignored frame error",e);
			}
		}
		
		this.Frames = [];
		Filenames.forEach( LoadFrame.bind(this) );
	}
	
	this.GetDuration = function()
	{
		return this.Frames[this.Frames.length-1].GetTime();
	}
	
	this.GetFrame = function(Time)
	{
		//	auto loop
		Time = Time % this.GetDuration();
		
		for ( let i=0;	i<this.Frames.length;	i++ )
		{
			let Frame = this.Frames[i];
			let FrameTime = Frame.GetTime();
			if ( Time <= FrameTime )
				return Frame;
		}
		throw "Failed to find frame for time " + Time;
	}
	
	this.GetTriangleBuffer = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.TriangleBuffer;
	}
	
	this.GetPositionsTexture = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return null;
	}
	
}







function TAnimatedActor(Meta)
{
	this.Position = Meta.Position;
	this.LocalToWorldTransform = Math.CreateTranslationMatrix(...this.Position);

	this.Animation = new TAnimationBuffer(Meta.Filename,Meta.Scale);
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Time = 0;
	this.Meta = Meta;
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget)
	{
		this.Animation.Init(RenderTarget);
		this.Time = Time;
	}
	
	this.GetTriangleBuffer = function(RenderTarget)
	{
		const tb = this.Animation.GetTriangleBuffer( this.Time );
		return tb;
	}
	
	this.GetPositionsTexture = function(RenderTarget)
	{
		const tb = this.Animation.GetPositionsTexture( this.Time );
		return tb;
	}
	
	this.GetVelocitysTexture = function(RenderTarget)
	{
		return null;
	}
	
	this.GetLocalToWorldTransform = function()
	{
		return Math.CreateTranslationMatrix( ...this.Position );
	}
	
	this.GetBoundingBox = function()
	{
		return this.Animation.BoundingBox;
	}
}













function PhysicsIteration(RenderTarget,Time,PositionTexture,VelocityTexture,ScratchTexture,PositionOrigTexture,UpdateVelocityShader,UpdatePositionShader,SetPhysicsUniforms)
{
	if ( !Params.EnablePhysicsIteration )
		return;
	
	SetPhysicsUniforms = SetPhysicsUniforms || function(){};
	
	let CopyShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	UpdateVelocityShader = Pop.GetShader( RenderTarget, UpdateVelocityShader, QuadVertShader );
	UpdatePositionShader = Pop.GetShader( RenderTarget, UpdatePositionShader, QuadVertShader );
	let Quad = GetQuadGeometry(RenderTarget);
	
	//	copy old velocitys
	let CopyVelcoityToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',VelocityTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyVelcoityToScratch );
	
	//	update velocitys
	let UpdateVelocitys = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', 1.0/60.0 );
			Shader.SetUniform('NoiseScale', 0.1 );
			Shader.SetUniform('Gravity', -0.1);
			Shader.SetUniform('Noise', RandomTexture);
			Shader.SetUniform('LastVelocitys',ScratchTexture);
			Shader.SetUniform('OrigPositions',PositionOrigTexture);
			Shader.SetUniform('LastPositions', PositionTexture );
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.DrawGeometry( Quad, UpdateVelocityShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( VelocityTexture, UpdateVelocitys );
	
	//	copy old positions
	let CopyPositionsToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',PositionTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyPositionsToScratch );
	
	//	update positions
	let UpdatePositions = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', 1.0/60.0 );
			Shader.SetUniform('Velocitys',VelocityTexture);
			Shader.SetUniform('LastPositions',ScratchTexture);
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.DrawGeometry( Quad, UpdatePositionShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( PositionTexture, UpdatePositions );
	
}


