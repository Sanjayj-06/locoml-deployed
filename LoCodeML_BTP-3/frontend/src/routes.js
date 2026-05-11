/*!

=========================================================
* Paper Dashboard React - v1.3.2
=========================================================

* Product Page: https://www.creative-tim.com/product/paper-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

* Licensed under MIT (https://github.com/creativetimofficial/paper-dashboard-react/blob/main/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import Dashboard from "views/Dashboard.js";
import UploadData from "views/UploadData";
import DataPreprocessing from "views/DataPreprocessing";
// import Preview from "views/Preview";
import EDA from "views/EDA";
import Train from "views/train";
import TrainedModels from "views/TrainedModels";
import ModelDetails from "views/ModelDetails";
import Inference from "views/Inference";
import Delete from "views/Delete";
import UpdateModel from "views/UpdateModel";
import InferenceZoo from "./views/InferenceZoo";
import ProcessSavedPipeline from "./views/ProcessSavedPipeline";

var routes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    showInSidebar: true,
    // icon: "nc-icon nc-bank",
    component: <Dashboard />,
  },
  {
    path: "/upload-data",
    name: "Upload Data",
    showInSidebar: true,
    // icon: "nc-icon nc-cloud-upload-94",
    component: <UploadData />,
  },
  {
    path: "/eda",
    name: "Exploratory Data Analysis",
    showInSidebar: true,
    // icon: "nc-icon nc-cloud-upload-94",
    component: <EDA />,
    // layout: "/admin",
  },
  {
    path: "/data-preprocessing",
    name: "Data Preprocessing",
    showInSidebar: true,
    // icon: "nc-icon nc-tile-56",
    component: <DataPreprocessing />,
  },
  {
    path: "/train",
    name: "Train",
    showInSidebar: true,
    // icon: "nc-icon nc-cloud-upload-94",
    component: <Train />,
  },
  {
    path: "/models",
    name: "Model Zoo",
    showInSidebar: true,
    // icon: "nc-icon nc-cloud-upload-94",
    component: <TrainedModels />,
  },
  {
    path: "/models/:model_id",
    name: "Model Details",
    showInSidebar: false,
    component: <ModelDetails />,
  },
  {
    path: "/inference",
    name: "Inference",
    showInSidebar: true,
    component: <Inference />,
  },
  { 
    path: "/delete",
    name: "Delete",
    showInSidebar: false,
    component: <Delete />,
  },
  {
    path: "/update/model/:model_id",
    name: "Update Model",
    showInSidebar: false,
    component: <UpdateModel />,
  },
  {
    path: "/pipelines",
    name: "Inference Zoo",
    showInSidebar: true,
    component: <InferenceZoo />
  },
  {
    path: "/pipeline/:pipeline_id",
    name: "Inference Pipeline",
    showInSidebar: false,
    component: <ProcessSavedPipeline />
  }
];
export default routes;
