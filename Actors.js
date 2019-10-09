

const BlitCopyShader = RegisterShaderAssetFilename('BlitCopy.frag.glsl','Quad.vert.glsl');
const BlitCopyMultipleShader = RegisterShaderAssetFilename('BlitCopyMultiple.frag.glsl','Quad.vert.glsl');
const UpdateVelocityShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateVelocity.frag.glsl','Quad.vert.glsl');
const UpdateVelocityPulseShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateVelocityPulse.frag.glsl','Quad.vert.glsl');
const UpdateVelocitySwirlShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateVelocitySwirl.frag.glsl','Quad.vert.glsl');
const UpdatePositionShader = RegisterShaderAssetFilename('PhysicsIteration_UpdatePosition.frag.glsl','Quad.vert.glsl');

const Noise_TurbulenceShader = RegisterShaderAssetFilename('Noise/TurbulencePerlin.frag.glsl','Quad.vert.glsl');

const AnimalParticleShader = RegisterShaderAssetFilename('AnimalParticle.frag.glsl','AnimalParticle.vert.glsl');
const DustParticleShader = RegisterShaderAssetFilename('AnimalParticle.frag.glsl','DustParticle.vert.glsl');

const GeoColourShader = RegisterShaderAssetFilename('Colour.frag.glsl','Geo.vert.glsl');
const GeoEdgeShader = RegisterShaderAssetFilename('Edge.frag.glsl','Geo.vert.glsl');


function TPhysicsActor(Meta)
{
	this.Position = Meta.Position;
	this.BoundingBox = null;
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Meta = Meta;
	
	if ( !this.Meta.UpdateVelocityShader )
		this.Meta.UpdateVelocityShader = UpdateVelocityShader;
	if ( !this.Meta.UpdatePositionShader )
		this.Meta.UpdatePositionShader = UpdatePositionShader;
	
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

		if ( this.Meta.PhysicsUpdateEnabled !== false )
			PhysicsIteration_MultipleShaders( RenderTarget, Time, FrameDuration, this.PositionTexture, this.VelocityTexture, this.ScratchTexture, this.PositionOrigTexture, this.Meta.UpdateVelocityShader, this.Meta.UpdatePositionShader, SetPhysicsUniforms );
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
		
		this.TriangleBuffer = LoadPointMeshFromFile( RenderTarget, Meta.Filename, this.GetIndexMap.bind(this), Meta.ScaleMeshToBounds );
		this.PositionTexture = this.TriangleBuffer.PositionTexture;
		this.ColourTexture = this.TriangleBuffer.ColourTexture;
		this.AlphaTexture = this.TriangleBuffer.AlphaTexture;
		if ( !this.BoundingBox )
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
	
}



function PhysicsIteration(RenderTarget,Time,FrameDuration,PositionTexture,VelocityTexture,PositionScratchTexture,VelocityScratchTexture,PositionOrigTexture,UpdateVelocityShaderAsset,UpdatePositionShaderAsset,SetPhysicsUniforms)
{
	if ( !Params.EnablePhysicsIteration )
		return;
	
	SetPhysicsUniforms = SetPhysicsUniforms || function(){};

	const RenderContext = RenderTarget.GetRenderContext();
	const PhysicsStep = FrameDuration;
	const CopyShader = GetAsset(BlitCopyShader, RenderContext );
	const CopyMultiShader = GetAsset(BlitCopyMultipleShader, RenderContext );
	const UpdateVelocityShader = GetAsset(UpdateVelocityShaderAsset, RenderContext );
	const UpdatePositionShader = GetAsset(UpdatePositionShaderAsset, RenderContext );
	const Quad = GetAsset('Quad', RenderContext);
	
	
	const CopyMrt = true;
	
	if ( CopyMrt )
	{
		//	copy old positions
		let CopyToScratch = function(RenderTarget)
		{
			let SetUniforms = function(Shader)
			{
				Shader.SetUniform('VertexRect', [0,0,1,1] );
				Shader.SetUniform('Texture0',PositionTexture);
				Shader.SetUniform('Texture1',VelocityTexture);
			}
			RenderTarget.DrawGeometry( Quad, CopyMultiShader, SetUniforms );
		}
		RenderTarget.RenderToRenderTarget( [PositionScratchTexture,VelocityScratchTexture], CopyToScratch );

	}
	else
	{
		throw "xx";
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
		RenderTarget.RenderToRenderTarget( VelocityScratchTexture, CopyVelcoityToScratch );

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
		RenderTarget.RenderToRenderTarget( PositionScratchTexture, CopyPositionsToScratch );
	}
	
	
	
	
	//	update velocitys
	let UpdateVelocitys = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', PhysicsStep );
			Shader.SetUniform('Gravity', 0 );
			Shader.SetUniform('Noise', RandomTexture);
			Shader.SetUniform('LastVelocitys',VelocityScratchTexture);
			Shader.SetUniform('OrigPositions',PositionOrigTexture);
			Shader.SetUniform('LastPositions', PositionTexture );
			Shader.SetUniform('LastPositionsFlipped',false);	//	only in MRT mode
			Shader.SetUniform('OrigPositionsWidthHeight', [PositionOrigTexture.GetWidth(),PositionOrigTexture.GetHeight()] );
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.DrawGeometry( Quad, UpdateVelocityShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( VelocityTexture, UpdateVelocitys );
	
	
	//	update positions
	let UpdatePositions = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', PhysicsStep );
			Shader.SetUniform('Velocitys',VelocityTexture);
			Shader.SetUniform('LastPositions',PositionScratchTexture);
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.DrawGeometry( Quad, UpdatePositionShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( PositionTexture, UpdatePositions );
	
}

