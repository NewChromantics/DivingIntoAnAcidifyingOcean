

const BlitCopyShader = RegisterShaderAssetFilename('BlitCopy.frag.glsl','Quad.vert.glsl');
const BlitDebugShader = RegisterShaderAssetFilename('BlitDebug.frag.glsl','Quad.vert.glsl');
const BlitCopyMultipleShader = RegisterShaderAssetFilename('BlitCopyMultiple.frag.glsl','Quad.vert.glsl');
const UpdateVelocityShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateVelocity.frag.glsl','Quad.vert.glsl');
const UpdateVelocityPulseShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateVelocityPulse.frag.glsl','Quad.vert.glsl');
const UpdateVelocitySwirlShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateVelocitySwirl.frag.glsl','Quad.vert.glsl');
const UpdatePositionShader = RegisterShaderAssetFilename('PhysicsIteration_UpdatePosition.frag.glsl','Quad.vert.glsl');
const UpdatePositionSwirlShader = RegisterShaderAssetFilename('PhysicsIteration_UpdatePositionSwirl.frag.glsl','Quad.vert.glsl');

//	pos+velocity, null disables
//	no MRT on mobile :/
//const UpdateSwirlShader = RegisterShaderAssetFilename('PhysicsIteration_UpdateSwirl.frag.glsl','Quad.vert.glsl');
const UpdateSwirlShader = null;

const Noise_TurbulenceShader = RegisterShaderAssetFilename('TurbulencePerlin.frag.glsl','Quad.vert.glsl');

const AnimalParticleShader = RegisterShaderAssetFilename('AnimalParticle.frag.glsl','AnimalParticle.vert.glsl');
const NastyAnimalParticleShader = RegisterShaderAssetFilename('NastyAnimalParticle.frag.glsl','NastyAnimalParticle.vert.glsl');
const WaterParticleShader = RegisterShaderAssetFilename('AnimalParticle.frag.glsl','WaterParticle.vert.glsl');
const DustParticleShader = RegisterShaderAssetFilename('AnimalParticle.frag.glsl','DustParticle.vert.glsl');

const GeoColourShader = RegisterShaderAssetFilename('Colour.frag.glsl','Geo.vert.glsl');
const GeoEdgeShader = RegisterShaderAssetFilename('Edge.frag.glsl','Geo.vert.glsl');


var Noise_TurbulenceTexture = new Pop.Image( [512,512], 'RGBA' );




function PhysicsIteration(RenderTarget,Time,FrameDuration,PositionTexture,VelocityTexture,PositionScratchTexture,VelocityScratchTexture,PositionOrigTexture,UpdateVelocityShaderAsset,UpdatePositionShaderAsset,SetPhysicsUniforms,DoCopy)
{
	if ( !Params.EnablePhysicsIteration )
		return;

	SetPhysicsUniforms = SetPhysicsUniforms || function(){};

	const RenderContext = RenderTarget.GetRenderContext();
	const PhysicsStep = FrameDuration;
	const CopyShader = GetAsset(BlitCopyShader, RenderContext );
	const UpdateVelocityShader = UpdateVelocityShaderAsset ? GetAsset(UpdateVelocityShaderAsset, RenderContext ) : null;
	const UpdatePositionShader = GetAsset(UpdatePositionShaderAsset, RenderContext );
	const Quad = GetAsset('Quad', RenderContext);
	
	//	we don't copy if caller is double buffering
	if ( DoCopy )
	{
		//	copy old velocitys
		let CopyVelcoityToScratch = function(RenderTarget)
		{
			let SetUniforms = function(Shader)
			{
				Shader.SetUniform('VertexRect', [0,0,1,1] );
				Shader.SetUniform('Texture',VelocityTexture);
			}
			RenderTarget.SetBlendModeBlit(true);
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
			RenderTarget.SetBlendModeBlit(true);
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
			Shader.SetUniform('LastPositions', PositionTexture );
			Shader.SetUniform('OrigPositions',PositionOrigTexture);
			//Shader.SetUniform('LastPositions', PositionScratchTexture );	//	<--- causes problems
			Shader.SetUniform('OrigPositionsWidthHeight', [PositionOrigTexture.GetWidth(),PositionOrigTexture.GetHeight()] );
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.SetBlendModeBlit(true);
		RenderTarget.DrawGeometry( Quad, UpdateVelocityShader, SetUniforms );
	}
	if ( UpdateVelocityShader )
	{
		RenderTarget.RenderToRenderTarget( VelocityTexture, UpdateVelocitys );
	}
	
	//	update positions
	let UpdatePositions = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', PhysicsStep );
			Shader.SetUniform('LastPositions',PositionScratchTexture);
			
			Shader.SetUniform('LastVelocitys',VelocityScratchTexture);
			Shader.SetUniform('OrigPositions',PositionOrigTexture);
			Shader.SetUniform('OrigPositionsWidthHeight', [PositionOrigTexture.GetWidth(),PositionOrigTexture.GetHeight()] );
			
			if ( UpdateVelocityShader )
				Shader.SetUniform('Velocitys',VelocityTexture);
			else
				Shader.SetUniform('Velocitys',VelocityScratchTexture);
			
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.SetBlendModeBlit(true);
		RenderTarget.DrawGeometry( Quad, UpdatePositionShader, SetUniforms );
	}
	//	if there's no velocity update, then we're rendering to two targets
	const Targets = [PositionTexture];
	if ( !UpdateVelocityShader )
		Targets.push( VelocityTexture );
	RenderTarget.RenderToRenderTarget( Targets, UpdatePositions );
	
}

