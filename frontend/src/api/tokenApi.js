import axiosInstance from "./axiosInstance";

export const refreshAccessToken = async () => {
  const response = await axiosInstance.post("/api/auth/refresh");
  return response.data;
};
