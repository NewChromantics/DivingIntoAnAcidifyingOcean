function TKeyframe(Time,Uniforms)
{
	this.Time = Time;
	this.Uniforms = Uniforms;
}

//	recursive so we can lerp arrays of arrays
function LerpArray(Min,Max,Time)
{
	let Values = Min.slice();
	for ( let i=0;	i<Min.length;	i++ )
		Values[i] = LerpValue( Min[i], Max[i], Time );
	return Values;
}

function LerpValue(a,b,Lerp)
{
	if ( Array.isArray(a) )
		return LerpArray( a, b, Lerp );

	let IsLerpable_a = ( typeof a == 'number' );
	let IsLerpable_b = ( typeof b == 'number' );

	//	bool, string, object, return previous until we hit next keyframe
	if ( Lerp >= 1.0 )
		return b;
	
	//	if a or b isn't lerpable, we return prev
	if ( !IsLerpable_a || !IsLerpable_b )
		return a;
	
	//	lerp number
	return Math.Lerp( a, b, Lerp );
}

class TTimeline
{
	constructor(OrigKeyframes)
	{
		//	gr: Expecting time to be sorted
		this.Keyframes = OrigKeyframes;
		this.FillKeyframes();
	}

	LastKeyframeTime()
	{
		const LastKeyframe = this.Keyframes[this.Keyframes.length-1];
		return LastKeyframe.Time;
	}

	GetNextKeyframeTime(Time,NoNextResult=undefined)
	{
		for (let Keyframe of this.Keyframes)
		{
			if (Keyframe.Time <= Time)
				continue;
			return Keyframe.Time;
		}
		return NoNextResult;
	}

	EnumAllUniforms()
	{
		//	keyed list and their first & last keyframe time
		let Uniforms = {};
		
		let EnumUniforms = function(Keyframe)
		{
			let EnumUniform = function(Uniform)
			{
				//	init new uniform
				if ( !Uniforms.hasOwnProperty(Uniform) )
				{
					Uniforms[Uniform] = {};
					Uniforms[Uniform].FirstKeyframeTime = Keyframe.Time;
					Uniforms[Uniform].LastKeyframeTime = null;
				}
				//	update existing uniform
				Uniforms[Uniform].LastKeyframeTime = Keyframe.Time;
			}
			Object.keys( Keyframe.Uniforms ).forEach (EnumUniform);
		}
		this.Keyframes.forEach( EnumUniforms );
		
		return Uniforms;
	}
	
	//	any keyframes missing a uniform, we should in-fill
	//	we could do it in the lookup, but doing once might be simpler
	FillKeyframes()
	{
		//	get list of all uniforms
		const AllUniforms = this.EnumAllUniforms();
		//Pop.Debug( JSON.stringify( AllUniforms,null,'\t' ) );
		
		//	now go through all keyframes and fill gaps
		let FillKeyframe = function(Keyframe)
		{
			let FillUniform = function(UniformName)
			{
				//	already exists
				if ( Keyframe.Uniforms.hasOwnProperty(UniformName) )
					return;
				
				//	fill!
				let KnownUniform = AllUniforms[UniformName];
				if ( Keyframe.Time < KnownUniform.FirstKeyframeTime )
				{
					Keyframe.Uniforms[UniformName] = this.GetUniform( KnownUniform.FirstKeyframeTime, UniformName );
				}
				else if ( Keyframe.Time > KnownUniform.LastKeyframeTime )
				{
					Keyframe.Uniforms[UniformName] = this.GetUniform( KnownUniform.LastKeyframeTime, UniformName );
				}
				else
				{
					const Slice = this.GetTimeSliceForUniform( Keyframe.Time, UniformName );
					const PrevValue = this.Keyframes[Slice.StartIndex].Uniforms[UniformName];
					const NextValue = this.Keyframes[Slice.EndIndex].Uniforms[UniformName];
					Keyframe.Uniforms[UniformName] = LerpValue( PrevValue, NextValue, Slice.Lerp );
				}
			}
			Object.keys(AllUniforms).forEach(FillUniform.bind(this));
		}
		this.Keyframes.forEach( FillKeyframe.bind(this) );
					
		//Pop.Debug( "Filled keyframes", JSON.stringify(this.Keyframes,null,'\t') );
	}

	GetTimeSliceForUniform(Time,UniformName)
	{
		if ( !this.Keyframes.length )
			return null;
		let Slice = {};
		Slice.StartIndex = undefined;
		Slice.EndIndex = undefined;
		
		for ( let i=0;	i<this.Keyframes.length;	i++ )
		{
			const Keyframe = this.Keyframes[i];
			if ( !Keyframe.Uniforms.hasOwnProperty(UniformName) )
				continue;
			
			//	find the latest keyframe that this could be
			if ( Keyframe.Time <= Time )
			{
				Slice.StartIndex = i;
			}
			
			//	find the first keyframe this could be
			if ( Slice.EndIndex === undefined && Keyframe.Time >= Time )
			{
				Slice.EndIndex = i;
			}
		}
		if ( Slice.StartIndex === undefined && Slice.EndIndex === undefined )
			throw "Uniform " + UniformName + " not found";
		//	there was only one match
		if ( Slice.EndIndex === undefined )
			Slice.EndIndex = Slice.StartIndex;
		if ( Slice.StartIndex === undefined )
			Slice.StartIndex = Slice.EndIndex;

		let StartTime = this.Keyframes[Slice.StartIndex].Time;
		let EndTime = this.Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	GetTimeSlice(Time)
	{
		if ( !this.Keyframes.length )
			return null;
		
		let Slice = {};
		Slice.StartIndex = 0;
		
		for ( let i=0;	i<this.Keyframes.length-1;	i++ )
		{
			let t = this.Keyframes[i].Time;
			if ( t > Time )
			{
				//Pop.Debug( "Time > t", Time, t);
				break;
			}
			Slice.StartIndex = i;
		}
		Slice.EndIndex = Slice.StartIndex+1;
		
		let StartTime = this.Keyframes[Slice.StartIndex].Time;
		let EndTime = this.Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	GetUniform(Time,Key)
	{
		let Slice = this.GetTimeSliceForUniform( Time, Key );
		if ( Slice == null )
			return undefined;
		const UniformsA = this.Keyframes[Slice.StartIndex].Uniforms;
		const UniformsB = this.Keyframes[Slice.EndIndex].Uniforms;

		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			
			let Value = LerpValue( a, b, Slice.Lerp );
			return Value;
		}
		let Value = LerpUniform( Key );
		return Value;
	}
	
	EnumUniforms(Time,EnumUniform)
	{
		let Slice = this.GetTimeSlice( Time );
		if ( Slice == null )
			return;
		let UniformsA = this.Keyframes[Slice.StartIndex].Uniforms;
		let UniformsB = this.Keyframes[Slice.EndIndex].Uniforms;
		let UniformKeys = Object.keys(UniformsA);
		
		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			let Value;
			
			if ( Array.isArray(a) )
				Value = Math.LerpArray( a, b, Slice.Lerp );
			else
				Value = Math.Lerp( a, b, Slice.Lerp );

			//Pop.Debug(Key, Value);
			EnumUniform( Key, Value );
		}
		UniformKeys.forEach( LerpUniform );
	}

}




