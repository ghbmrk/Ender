#include "AI/EnderAITypes.h"

#include "Combat/EnderTargetSweepComponent.h"

FEnderTelegraphShape FEnderTelegraphShape::MakeCircle(const FVector& Center, float InRadius)
{
	FEnderTelegraphShape S;
	S.Shape = EEnderTelegraphShape::Circle;
	S.Origin = Center;
	S.Radius = InRadius;
	return S;
}

FEnderTelegraphShape FEnderTelegraphShape::MakeCone(const FVector& Apex, const FVector& Forward, float Reach, float InArcDegrees)
{
	FEnderTelegraphShape S;
	S.Shape = EEnderTelegraphShape::Cone;
	S.Origin = Apex;
	S.Direction = Forward.GetSafeNormal2D(UE_SMALL_NUMBER, FVector::ForwardVector);
	S.Radius = Reach;
	S.ArcDegrees = InArcDegrees;
	return S;
}

FEnderTelegraphShape FEnderTelegraphShape::MakeLane(const FVector& Start, const FVector& InDirection, float InLength, float InWidth)
{
	FEnderTelegraphShape S;
	S.Shape = EEnderTelegraphShape::Lane;
	S.Origin = Start;
	S.Direction = InDirection.GetSafeNormal2D(UE_SMALL_NUMBER, FVector::ForwardVector);
	S.Length = InLength;
	S.Width = InWidth;
	return S;
}

TArray<FHitResult> FEnderTelegraphShape::Query(UEnderTargetSweepComponent* Sweep, bool bMultiHit) const
{
	if (!Sweep) return {};
	switch (Shape)
	{
	case EEnderTelegraphShape::Cone: return Sweep->ConeQuery(Origin, Direction, Radius, ArcDegrees, bMultiHit);
	case EEnderTelegraphShape::Lane: return Sweep->LaneQuery(Origin, Direction, Length, Width, bMultiHit);
	default: return Sweep->RadialQuery(Origin, Radius, bMultiHit);
	}
}

FVector2D FEnderTelegraphShape::DrawHalfExtents() const
{
	switch (Shape)
	{
	case EEnderTelegraphShape::Lane: return FVector2D(Length * 0.5f, Width * 0.5f);
	default: return FVector2D(Radius, Radius); // the cone is drawn masked inside its full circle
	}
}

FVector FEnderTelegraphShape::DrawCenter() const
{
	return Shape == EEnderTelegraphShape::Lane ? Origin + Direction * (Length * 0.5f) : Origin;
}
