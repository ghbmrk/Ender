// Ender — fixed isometric camera math: framing, lookahead, follow, zoom, hit kick.
#pragma once

#include <cmath>

#include "CombatRules.h"

namespace EnderRules
{
	namespace CameraRules
	{
		constexpr double VerticalFov = 38.0;
		constexpr double Yaw = 45.0;
		constexpr double Pitch = -52.0;
		constexpr double ArmDefault = 1550.0;
		constexpr double ArmMin = 1350.0;
		constexpr double ArmMax = 1800.0;
		constexpr double ZoomStep = 75.0;
		constexpr double ZoomInterp = 0.18;
		constexpr double TargetOffsetZ = 90.0;
		constexpr double Aspect = 16.0 / 9.0;

		constexpr double LookaheadMax = 135.0;
		constexpr double LookaheadFullAt = 500.0;
		constexpr double FollowSmoothTime = 0.100;
		constexpr double MaxTrackingLag = 45.0;

		constexpr double Pi = 3.14159265358979323846;
		inline double Rad(double D) { return D * Pi / 180.0; }

		/** Lookahead offset (2D) toward the ground aim point. Full 135 cm at ≥500 cm, linear below. */
		inline void Lookahead(double PX, double PY, double AimX, double AimY, double& OutX, double& OutY)
		{
			const double DX = AimX - PX, DY = AimY - PY;
			const double L = std::sqrt(DX * DX + DY * DY);
			if (L < 1e-3)
			{
				OutX = OutY = 0;
				return;
			}
			const double Mag = LookaheadMax * Clamp01(L / LookaheadFullAt);
			OutX = DX / L * Mag;
			OutY = DY / L * Mag;
		}

		/**
		 * Critically damped follow (per axis), the same closed form as Unity's SmoothDamp /
		 * Game Programming Gems 4 §1.10. Velocity is carried between frames.
		 */
		inline double SmoothDamp(double Current, double Target, double& Velocity, double SmoothTime, double Dt)
		{
			const double Omega = 2.0 / SmoothTime;
			const double X = Omega * Dt;
			const double Exp = 1.0 / (1.0 + X + 0.48 * X * X + 0.235 * X * X * X);
			const double Change = Current - Target;
			const double Temp = (Velocity + Omega * Change) * Dt;
			Velocity = (Velocity - Omega * Temp) * Exp;
			return Target + (Change + Temp) * Exp;
		}

		/** After smoothing, never let the focus trail the desired point by more than 45 cm. */
		inline void ClampLag(double DesiredX, double DesiredY, double& FocusX, double& FocusY)
		{
			const double DX = FocusX - DesiredX, DY = FocusY - DesiredY;
			const double L = std::sqrt(DX * DX + DY * DY);
			if (L > MaxTrackingLag)
			{
				FocusX = DesiredX + DX / L * MaxTrackingLag;
				FocusY = DesiredY + DY / L * MaxTrackingLag;
			}
		}

		inline double StepZoom(double TargetArm, int Notches)
		{
			return Clamp(TargetArm + ZoomStep * Notches, ArmMin, ArmMax);
		}

		/** Eased (smoothstep) arm length T seconds into a 0.18 s zoom from From to To. */
		inline double ZoomAt(double From, double To, double T)
		{
			const double A = Clamp01(T / ZoomInterp);
			return From + (To - From) * A * A * (3.0 - 2.0 * A);
		}

		/** Hit kick: amplitude decaying with (1 - t/decay)^2; zero after decay. */
		inline double KickAt(double Amplitude, double Decay, double T)
		{
			if (T >= Decay || Decay <= 0) return 0;
			const double K = 1.0 - T / Decay;
			return Amplitude * K * K;
		}

		/**
		 * Projects a ground point (world 2D, z = 0) to normalised screen coords for the
		 * default camera centred on the player. U,V ∈ [0,1] is on screen. Used by the
		 * rule tests; the engine uses the real player camera projection.
		 */
		inline void ProjectToScreen(double PX, double PY, double WX, double WY, double& U, double& V,
			double Arm = ArmDefault)
		{
			const double Cp = std::cos(Rad(Pitch)), Sp = std::sin(Rad(Pitch));
			const double Cy = std::cos(Rad(Yaw)), Sy = std::sin(Rad(Yaw));
			const double F[3] = {Cp * Cy, Cp * Sy, Sp};
			const double R[3] = {-Sy, Cy, 0};
			const double Up[3] = {F[1] * R[2] - F[2] * R[1], F[2] * R[0] - F[0] * R[2], F[0] * R[1] - F[1] * R[0]};
			const double C[3] = {PX - F[0] * Arm, PY - F[1] * Arm, TargetOffsetZ - F[2] * Arm};
			const double D[3] = {WX - C[0], WY - C[1], 0 - C[2]};
			const double Xc = D[0] * R[0] + D[1] * R[1] + D[2] * R[2];
			const double Yc = D[0] * Up[0] + D[1] * Up[1] + D[2] * Up[2];
			const double Zc = D[0] * F[0] + D[1] * F[1] + D[2] * F[2];
			const double TanV = std::tan(Rad(VerticalFov) * 0.5), TanH = TanV * Aspect;
			if (Zc <= 1e-3)
			{
				U = V = -10;
				return;
			}
			U = 0.5 + 0.5 * Xc / (Zc * TanH);
			V = 0.5 - 0.5 * Yc / (Zc * TanV);
		}
	}
}
